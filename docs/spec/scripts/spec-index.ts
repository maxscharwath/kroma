#!/usr/bin/env bun
/**
 * Build a machine-readable index of every requirement in the KROMA spec.
 *
 * An agent (or a person) resolves any requirement ID to its exact location in
 * one lookup instead of grepping prose: read `docs/spec/requirements.json`,
 * find the ID, jump to `file` + `line`. The human-facing `docs/spec/INDEX.md`
 * is generated from the same data so the two never drift.
 *
 * There is no hardcoded list of domains or prefixes. A file's prefix is whatever
 * its requirements use; the script discovers it. The only rules it enforces are
 * the ones that keep IDs unambiguous:
 *   - a file uses exactly one prefix (no mixing prefixes in one file),
 *   - a prefix belongs to exactly one file (no two files sharing a prefix),
 *   - every requirement ID is unique, and every line carries a valid status.
 * Adding a domain is just adding a file and picking a prefix — no code change.
 *
 * Two modes:
 *   default   — regenerate requirements.json + INDEX.md on disk.
 *   --check    — verify only. Writes nothing; exits non-zero if the committed
 *                artefacts are stale or any requirement is invalid. Safe in CI.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SPEC_DIR = join(import.meta.dir, "..");

const STATUSES = ["SHIPPED", "AGREED", "DRAFT", "DESIGN, NOT IMPLEMENTED"] as const;
type Status = (typeof STATUSES)[number];

interface Requirement {
  id: string;
  domain: string; // the prefix, discovered from the file — not from a fixed list
  number: number;
  status: Status;
  text: string;
  file: string;
  line: number;
}

// A requirement line is an ID token first — `**LIB-4**` — then the rest. Split in
// two so a line that has the ID but a malformed remainder is *reported*, not
// silently skipped like a line that was never a requirement at all.
const REQ_ID = /^\s*(?:[-*]\s+)?\*\*([A-Z][A-Z0-9]*)-(\d+)\*\*(.*)$/;
// (STATUS) — text.  Accept em-dash, en-dash or hyphen as the separator.
const REQ_REST = /^\s*\(([^)]+)\)\s*[—–-]\s*(\S.*?)\s*$/;

async function collect(): Promise<{ reqs: Requirement[]; errors: string[] }> {
  const reqs: Requirement[] = [];
  const errors: string[] = [];
  const seenId = new Map<string, string>(); // id -> "file:line" of first sighting
  const prefixOwner = new Map<string, string>(); // prefix -> the file that owns it
  const filePrefix = new Map<string, string>(); // file -> the one prefix it uses

  const files = (await readdir(SPEC_DIR)).filter(
    (f) => f.endsWith(".md") && f !== "README.md" && f !== "INDEX.md",
  );

  for (const file of files.sort()) {
    const lines = (await readFile(join(SPEC_DIR, file), "utf8")).split("\n");
    let inFence = false;
    lines.forEach((raw, i) => {
      // Never parse inside a fenced code block — spec files show example
      // requirement lines there, and those are illustrations, not requirements.
      if (/^\s*(```|~~~)/.test(raw)) {
        inFence = !inFence;
        return;
      }
      if (inFence) return;

      const idm = raw.match(REQ_ID);
      if (!idm) return;
      const [, prefix, num, rest] = idm;
      const line = i + 1;
      const where = `${file}:${line}`;

      // One prefix per file.
      const established = filePrefix.get(file);
      if (established === undefined) {
        filePrefix.set(file, prefix);
      } else if (established !== prefix) {
        errors.push(
          `${where}: ${file} already uses prefix "${established}-", but this line uses "${prefix}-". ` +
            `One prefix per file.`,
        );
        return;
      }
      // A prefix belongs to one file.
      const owner = prefixOwner.get(prefix);
      if (owner === undefined) {
        prefixOwner.set(prefix, file);
      } else if (owner !== file) {
        errors.push(`${where}: prefix "${prefix}-" is already used by ${owner}. A prefix belongs to one file.`);
        return;
      }

      const restm = rest.match(REQ_REST);
      if (!restm) {
        errors.push(
          `${where}: "${prefix}-${num}" is not a well-formed requirement line ` +
            `(expected \`**${prefix}-${num}** (STATUS) — text\`)`,
        );
        return;
      }
      const [, statusRaw, textRaw] = restm;
      const status = statusRaw.trim();
      if (!STATUSES.includes(status as Status)) {
        errors.push(`${where}: "${prefix}-${num}" has invalid status "${status}"`);
        return;
      }

      // Normalise the number so LIB-04 and LIB-4 collide instead of masquerading
      // as two distinct requirements that happen to share a number.
      const number = Number(num);
      const id = `${prefix}-${number}`;
      if (seenId.has(id)) {
        errors.push(`${where}: duplicate requirement ${id} (first at ${seenId.get(id)})`);
        return;
      }
      seenId.set(id, where);
      reqs.push({
        id,
        domain: prefix,
        number,
        status: status as Status,
        text: textRaw.replace(/\s+/g, " "),
        file: `docs/spec/${file}`,
        line,
      });
    });
  }

  reqs.sort((a, b) => a.file.localeCompare(b.file) || a.number - b.number);
  return { reqs, errors };
}

function renderIndex(reqs: Requirement[]): string {
  const out: string[] = [
    "<!-- Generated by docs/spec/scripts/spec-index.ts — do not edit by hand. -->",
    "<!-- Run `bun run spec:index` after changing any requirement. -->",
    "",
    "# Requirement index",
    "",
    `${reqs.length} requirement${reqs.length === 1 ? "" : "s"} across the spec. ` +
      "The machine-readable source is [`requirements.json`](requirements.json).",
    "",
  ];
  // Group by file, keeping first-seen order (reqs are already sorted by file).
  const byFile = new Map<string, Requirement[]>();
  for (const r of reqs) {
    let list = byFile.get(r.file);
    if (!list) byFile.set(r.file, (list = []));
    list.push(r);
  }

  for (const [file, list] of byFile) {
    const name = file.replace("docs/spec/", "");
    out.push(`## ${list[0].domain} — [${name}](${name})`, "");
    for (const r of list) out.push(`- **${r.id}** (${r.status}) — ${r.text}`);
    out.push("");
  }
  return out.join("\n");
}

const check = process.argv.includes("--check");
const { reqs, errors } = await collect();

if (errors.length) {
  console.error("Spec index found problems:\n" + errors.map((e) => `  ✗ ${e}`).join("\n"));
  process.exit(1);
}

const json = JSON.stringify(reqs, null, 2) + "\n";
const index = renderIndex(reqs);
const jsonPath = join(SPEC_DIR, "requirements.json");
const indexPath = join(SPEC_DIR, "INDEX.md");

if (check) {
  const stale: string[] = [];
  for (const [path, want] of [
    [jsonPath, json],
    [indexPath, index],
  ] as const) {
    const have = await readFile(path, "utf8").catch(() => null);
    if (have !== want) stale.push(path);
  }
  if (stale.length) {
    console.error(
      "Spec index is out of date:\n" +
        stale.map((p) => `  ✗ ${p}`).join("\n") +
        "\nRun `bun run spec:index` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`Spec index: ${reqs.length} requirement(s), up to date.`);
} else {
  await writeFile(jsonPath, json);
  await writeFile(indexPath, index);
  console.log(
    `Spec index: ${reqs.length} requirement(s) written to requirements.json + INDEX.md.`,
  );
}
