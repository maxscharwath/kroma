//! Ledger write / lifecycle operations. Every write here is batched into a
//! single (IMMEDIATE) transaction so the many stage workers never contend on
//! SQLite's single writer. Timestamps are epoch milliseconds.

use std::collections::{HashMap, HashSet};

use rusqlite::TransactionBehavior;

use crate::db::*;

/// How many times a failed task is auto-retried across drains before it sticks
/// as `failed` (and waits for a manual retry). Transient blips (a locked file, a
/// momentary TMDB hiccup) clear on the next run; a genuinely broken subject stops
/// churning.
pub const MAX_ATTEMPTS: i64 = 3;

/// A unit of work: the subject's id + a signature of its current inputs. A task
/// is skipped while `status='done'` and its stored signature still matches, and
/// re-queued the moment the signature changes.
pub type Subject = (String, String);

/// Reconcile a stage's ledger against the freshly-enumerated `subjects` (one
/// transaction). Insert missing subjects as `pending`; re-`pending` any whose
/// signature changed; give `failed` rows with attempts `< MAX_ATTEMPTS` another
/// try (bounded auto-retry); delete rows for subjects that no longer exist. Rows
/// that are `done` with an unchanged signature are left untouched that is the
/// incremental skip. `running` rows are never disturbed.
pub fn reconcile(
    pool: &Pool,
    stage: &str,
    subject_kind: &str,
    subjects: &[Subject],
    now: i64,
) -> Result<()> {
    let mut conn = pool.get()?;
    // IMMEDIATE so we take the write lock at BEGIN: a read-then-write (deferred)
    // transaction can't upgrade while another connection is writing and fails
    // `SQLITE_BUSY` instead of waiting. With IMMEDIATE, `busy_timeout` serializes
    // concurrent stage drains (which happen when several stages run at once, e.g.
    // a reprocess) rather than erroring one of them out.
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let existing: HashMap<String, (Option<String>, String, i64)> = {
        let mut stmt = tx.prepare(
            "SELECT subject_id, input_sig, status, attempts FROM pipeline_tasks WHERE stage=?1",
        )?;
        let rows = stmt.query_map(params![stage], |r| {
            Ok((
                r.get::<_, String>(0)?,
                (r.get::<_, Option<String>>(1)?, r.get::<_, String>(2)?, r.get::<_, i64>(3)?),
            ))
        })?;
        rows.collect::<rusqlite::Result<HashMap<_, _>>>()?
    };
    let present: HashSet<&str> = subjects.iter().map(|(id, _)| id.as_str()).collect();
    for (id, sig) in subjects {
        match existing.get(id) {
            None => {
                tx.execute(
                    "INSERT INTO pipeline_tasks \
                       (stage,subject_kind,subject_id,status,input_sig,attempts,priority,enqueued_at,updated_at) \
                     VALUES (?1,?2,?3,'pending',?4,0,0,?5,?5)",
                    params![stage, subject_kind, id, sig, now],
                )?;
            }
            Some((old_sig, status, attempts)) => {
                if status == "running" {
                    continue;
                }
                // Only a PRESENT-but-different signature means the inputs changed:
                // a NULL/unknown old sig (e.g. a task enqueued by `enqueue`, which
                // omits input_sig) must NOT be treated as a change, or a just-
                // finished reprocess would be re-run once more here. It is instead
                // backfilled below without disturbing status.
                let sig_changed = old_sig.is_some() && old_sig.as_deref() != Some(sig.as_str());
                if sig_changed {
                    tx.execute(
                        "UPDATE pipeline_tasks SET status='pending', input_sig=?4, attempts=0, \
                           error=NULL, enqueued_at=?5, updated_at=?5 \
                         WHERE stage=?1 AND subject_kind=?2 AND subject_id=?3",
                        params![stage, subject_kind, id, sig, now],
                    )?;
                } else {
                    // Backfill a missing signature so it stops looking "changed" on
                    // the next reconcile. Never resets status/priority.
                    if old_sig.is_none() {
                        tx.execute(
                            "UPDATE pipeline_tasks SET input_sig=?4, updated_at=?5 \
                             WHERE stage=?1 AND subject_kind=?2 AND subject_id=?3",
                            params![stage, subject_kind, id, sig, now],
                        )?;
                    }
                    // Bounded auto-retry for transient failures.
                    if status == "failed" && *attempts < MAX_ATTEMPTS {
                        tx.execute(
                            "UPDATE pipeline_tasks SET status='pending', updated_at=?4 \
                             WHERE stage=?1 AND subject_kind=?2 AND subject_id=?3",
                            params![stage, subject_kind, id, now],
                        )?;
                    }
                }
            }
        }
    }
    for id in existing.keys() {
        if !present.contains(id.as_str()) {
            tx.execute(
                "DELETE FROM pipeline_tasks WHERE stage=?1 AND subject_id=?2",
                params![stage, id],
            )?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Force one subject to `pending` at (at least) `priority`, inserting the task if
/// it doesn't exist yet. Used by "reprocess this element": the higher priority
/// makes it jump the routine backlog, and the signature is left for the stage's
/// next reconcile to normalize.
pub fn enqueue(
    pool: &Pool,
    stage: &str,
    subject_kind: &str,
    id: &str,
    priority: i64,
    now: i64,
) -> Result<()> {
    let conn = pool.get()?;
    conn.execute(
        "INSERT INTO pipeline_tasks \
           (stage,subject_kind,subject_id,status,attempts,priority,enqueued_at,updated_at) \
         VALUES (?1,?2,?3,'pending',0,?4,?5,?5) \
         ON CONFLICT(stage,subject_kind,subject_id) DO UPDATE SET \
           status='pending', attempts=0, error=NULL, \
           priority=MAX(priority, excluded.priority), \
           enqueued_at=excluded.enqueued_at, updated_at=excluded.updated_at",
        params![stage, subject_kind, id, priority, now],
    )?;
    Ok(())
}

/// Claim up to `limit` pending tasks for a stage: pick the highest-priority /
/// oldest, flip them to `running`, and return `(subject_id, input_sig)` for the
/// worker pool. One transaction, so a second claimer (there is none per stage the
/// one-run-per-key rule guarantees it) could never double-claim.
pub fn claim_batch(pool: &Pool, stage: &str, limit: usize, now: i64) -> Result<Vec<Subject>> {
    let mut conn = pool.get()?;
    // IMMEDIATE so we take the write lock at BEGIN: a read-then-write (deferred)
    // transaction can't upgrade while another connection is writing and fails
    // `SQLITE_BUSY` instead of waiting. With IMMEDIATE, `busy_timeout` serializes
    // concurrent stage drains (which happen when several stages run at once, e.g.
    // a reprocess) rather than erroring one of them out.
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let picked: Vec<Subject> = {
        let mut stmt = tx.prepare(
            "SELECT subject_id, COALESCE(input_sig,'') FROM pipeline_tasks \
             WHERE stage=?1 AND status='pending' ORDER BY priority DESC, enqueued_at LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![stage, limit as i64], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    for (id, _) in &picked {
        tx.execute(
            "UPDATE pipeline_tasks SET status='running', started_at=?3, updated_at=?3 \
             WHERE stage=?1 AND subject_id=?2",
            params![stage, id, now],
        )?;
    }
    tx.commit()?;
    Ok(picked)
}

/// The outcome of processing one claimed task.
pub struct TaskResult {
    pub id: String,
    /// `None` = success; `Some(msg)` = failed with this error.
    pub error: Option<String>,
    pub duration_ms: i64,
}

/// Write a batch of results back (one transaction). Success → `done`; failure →
/// `failed` with `attempts` incremented (a later reconcile retries it while under
/// [`MAX_ATTEMPTS`]).
pub fn finish_batch(pool: &Pool, stage: &str, results: &[TaskResult], now: i64) -> Result<()> {
    let mut conn = pool.get()?;
    // IMMEDIATE so we take the write lock at BEGIN: a read-then-write (deferred)
    // transaction can't upgrade while another connection is writing and fails
    // `SQLITE_BUSY` instead of waiting. With IMMEDIATE, `busy_timeout` serializes
    // concurrent stage drains (which happen when several stages run at once, e.g.
    // a reprocess) rather than erroring one of them out.
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    for r in results {
        match &r.error {
            None => tx.execute(
                "UPDATE pipeline_tasks SET status='done', error=NULL, finished_at=?3, \
                   duration_ms=?4, updated_at=?3 WHERE stage=?1 AND subject_id=?2",
                params![stage, r.id, now, r.duration_ms],
            )?,
            Some(e) => tx.execute(
                "UPDATE pipeline_tasks SET status='failed', attempts=attempts+1, error=?3, \
                   finished_at=?4, duration_ms=?5, updated_at=?4 WHERE stage=?1 AND subject_id=?2",
                params![stage, r.id, e, now, r.duration_ms],
            )?,
        };
    }
    tx.commit()?;
    Ok(())
}

/// Flip `running` tasks back to `pending`, for a stage or all stages. Called at
/// startup (crash recovery, mirroring `reconcile_running_runs`) and at the end of
/// a cancelled drain so claimed-but-unprocessed tasks aren't stranded `running`.
pub fn reset_running(pool: &Pool, stage: Option<&str>) -> Result<usize> {
    let conn = pool.get()?;
    let now = crate::services::jobs::now_ms();
    let n = match stage {
        Some(s) => conn.execute(
            "UPDATE pipeline_tasks SET status='pending', updated_at=?2 \
             WHERE stage=?1 AND status='running'",
            params![s, now],
        )?,
        None => conn.execute(
            "UPDATE pipeline_tasks SET status='pending', updated_at=?1 WHERE status='running'",
            params![now],
        )?,
    };
    Ok(n)
}

/// Priority given to a manually-retried task so it jumps ahead of the routine
/// (priority 0) backlog on the next claim. Matches the reprocess fast-track tier.
pub const RETRY_PRIORITY: i64 = 100;

/// Reset `failed` tasks back to `pending` (attempts cleared) for a manual retry:
/// the whole stage (`subject_id = None`) or one task. Bumps priority so the retry
/// is claimed BEFORE the normal backlog (claim orders `priority DESC`).
pub fn retry(pool: &Pool, stage: &str, subject_id: Option<&str>) -> Result<usize> {
    let conn = pool.get()?;
    let now = crate::services::jobs::now_ms();
    let n = match subject_id {
        Some(id) => conn.execute(
            "UPDATE pipeline_tasks SET status='pending', attempts=0, error=NULL, \
               priority=MAX(priority, ?3), updated_at=?4 \
             WHERE stage=?1 AND subject_id=?2 AND status='failed'",
            params![stage, id, RETRY_PRIORITY, now],
        )?,
        None => conn.execute(
            "UPDATE pipeline_tasks SET status='pending', attempts=0, error=NULL, \
               priority=MAX(priority, ?2), updated_at=?3 \
             WHERE stage=?1 AND status='failed'",
            params![stage, RETRY_PRIORITY, now],
        )?,
    };
    Ok(n)
}

/// Force a full re-run of a stage: every non-running task back to `pending`. The
/// per-artifact skip still lives in each stage's `enumerate`/`process` (e.g. a
/// cached storyboard is a no-op), so this re-invokes the stage over all subjects
/// rather than deleting cached artifacts.
pub fn reprocess(pool: &Pool, stage: &str) -> Result<usize> {
    let conn = pool.get()?;
    let now = crate::services::jobs::now_ms();
    let n = conn.execute(
        "UPDATE pipeline_tasks SET status='pending', attempts=0, error=NULL, updated_at=?2 \
         WHERE stage=?1 AND status!='running'",
        params![stage, now],
    )?;
    Ok(n)
}
