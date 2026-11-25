import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-runs-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs sorted by job and counts 1 bad line', () => {
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates runs, retries, last status and last error', () => {
    expect(night?.rows.find((r) => r.job === 'fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503', // kept although the last run was ok
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(night?.rows.find((r) => r.job === 'lane/sync')).toMatchObject({
      runs: 8, // the truncated ninth line is the bad one
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
    expect(night?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('keeps a null owner', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')).toMatchObject({
      owner: null,
      lastError: null,
    });
  });
});

describe('readNight edges', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tmp, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    writeFileSync(join(tmp, 'secret.jsonl'), '');
    expect(readNight(tmp, 'secret')).toBeNull();
    expect(readNight(join(tmp, 'sub'), '../secret')).toBeNull();
  });

  it('reads an empty file as a night where nothing ran', () => {
    writeFileSync(join(tmp, '2026-01-02.jsonl'), '');
    expect(readNight(tmp, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts unusable lines and skips blank ones', () => {
    writeFileSync(
      join(tmp, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T23:00:00+01:00","job":"a","status":"ok","owner":null}',
        '',
        'not json',
        '{"at":"2026-01-03T23:01:00+01:00","job":"a","status":"done","owner":null}',
        '{"at":"yesterday","job":"a","status":"ok","owner":null}',
        '{"at":"2026-01-03T23:02:00+01:00","status":"ok","owner":null}',
        '42',
        '',
      ].join('\n'),
    );
    const night = readNight(tmp, '2026-01-03');
    expect(night?.badLines).toBe(5);
    expect(night?.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-03T23:00:00+01:00',
        lastAt: '2026-01-03T23:00:00+01:00',
      },
    ]);
  });
});
