// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null here; views show it as —
  runs: number; // every parsed line for the job, retries included
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // the most recent line that carried an error, even if a later run was ok
  firstAt: string; // as written in the log, offset kept
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD, the file name without .jsonl
  rows: DigestRow[]; // sorted by job
  badLines: number; // lines that did not parse: counted, never thrown
};

// null = no file for that night (a 404). An empty file is a Night with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
