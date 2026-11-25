import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

const isStatus = (v: unknown): v is RunStatus => v === 'ok' || v === 'retry' || v === 'fail';

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// The edge: anything that is not a usable run line comes back as null.
function parseLine(text: string): Line | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { at, job, status, owner, error } = raw as Record<string, unknown>;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  return {
    at,
    job,
    status,
    owner: typeof owner === 'string' ? owner : null,
    error: typeof error === 'string' ? error : null,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  // night comes from a URL: validate before it reaches a path.
  if (!NIGHT.test(night)) return null;

  let content: string;
  try {
    content = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null;
    throw err;
  }

  const rows = new Map<string, DigestRow>();
  let badLines = 0;

  // First, last and lastStatus follow the order of the file: the log is append-only.
  for (const text of content.split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (!line) {
      badLines++;
      continue;
    }
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    row.owner = line.owner;
    if (line.error !== null) row.lastError = line.error;
  }

  return {
    night,
    rows: [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0)),
    badLines,
  };
};
