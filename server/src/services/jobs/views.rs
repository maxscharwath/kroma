//! The API read models for the job console (`list` / `detail` / `info_for`)
//! split out of [`super`] to keep the manager file focused. `impl JobManager` in
//! a sibling file; same-module privacy lets it read the manager's private state.

use time::OffsetDateTime;

use super::{now_local, Cron, JobKey, JobManager, RUNS_KEPT};
use crate::db;
use crate::model::{JobDetail, JobInfo};
use crate::state::SharedState;

impl JobManager {
    /// All jobs as wire-ready [`JobInfo`], in registration order.
    pub fn list(&self, state: &SharedState) -> Vec<JobInfo> {
        let now = now_local(state);
        let pool = state.db.clone();
        self.order.iter().filter_map(|&job| self.info_for(&pool, now, job)).collect()
    }

    /// One job plus its recent run history.
    pub fn detail(&self, state: &SharedState, job: JobKey) -> Option<JobDetail> {
        let now = now_local(state);
        let pool = state.db.clone();
        let info = self.info_for(&pool, now, job)?;
        let runs = db::list_job_runs(&pool, job.as_str(), RUNS_KEPT).unwrap_or_default();
        Some(JobDetail { info, runs })
    }

    /// Build the wire [`JobInfo`] for one job: static metadata + effective
    /// schedule + next fire time + live run progress.
    fn info_for(&self, pool: &db::Pool, now: OffsetDateTime, job: JobKey) -> Option<JobInfo> {
        let builtin = self.jobs.get(&job)?;
        let st = self.schedules.read().unwrap().get(&job).cloned()?;

        // Next scheduled fire, if enabled and on a (valid) schedule.
        let next_run_at = if st.enabled {
            st.schedule
                .as_deref()
                .and_then(|e| Cron::parse(e).ok())
                .and_then(|c| c.next_after(now))
                .map(|t| (t.unix_timestamp_nanos() / 1_000_000) as i64)
        } else {
            None
        };

        let running = self.running.read().unwrap().get(&job).cloned();
        let (progress_done, progress_total) = match &running {
            Some(h) => {
                let (d, t) = h.progress();
                (Some(d), Some(t))
            }
            None => (None, None),
        };

        Some(JobInfo {
            key: job.as_str().to_string(),
            name: format!("jobs.{}.name", job.as_str()),
            description: format!("jobs.{}.desc", job.as_str()),
            category: builtin.category,
            schedule: st.schedule.clone(),
            default_schedule: builtin.schedule.map(str::to_string),
            customized: st.customized,
            enabled: st.enabled,
            running: running.is_some(),
            run_id: running.as_ref().map(|h| h.run_id.clone()),
            progress_done,
            progress_total,
            next_run_at,
            last_run: db::last_job_run(pool, job.as_str()).ok().flatten(),
        })
    }
}
