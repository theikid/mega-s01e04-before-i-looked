import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Temp runs dir: the repo's runs/ is read-only fixtures and never touched here.
const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

const normal = [
  '{"at":"2026-11-02T01:00:00+01:00","job":"digest/render","status":"ok","owner":"rook"}',
  '{"at":"2026-11-02T02:00:00+01:00","job":"lane/sync","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-11-02T02:05:00+01:00","job":"lane/sync","status":"fail","owner":null,"error":"quota exceeded"}',
];

const valid = [
  '{"at":"2026-11-04T01:00:00+01:00","job":"digest/render","status":"ok","owner":"rook"}',
  '{"at":"2026-11-04T02:00:00+01:00","job":"notes/backup","status":"ok","owner":"rook"}',
];

beforeAll(() => {
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), normal.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-11-03.jsonl'), '');
  writeFileSync(join(runsDir, '2026-11-04.jsonl'), [valid[0], 'not json', valid[1]].join('\n') + '\n');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

type JsonNight = { night: string; rows: { job: string }[]; badLines: number };

describe('GET /digest/:night', () => {
  it('renders the jobs of a normal night', async () => {
    const res = await createApp(config).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(html).toContain('lane/sync');
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-11-05');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('keeps the valid jobs and reports the bad line', async () => {
    const res = await createApp(config).request('/digest/2026-11-04');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest/render');
    expect(html).toContain('notes/backup');
    expect(html).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows of a normal night', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-02');
    const body = (await res.json()) as JsonNight;
    expect(res.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-05');
    expect(res.status).toBe(404);
  });

  it('returns no rows and no bad lines for an empty night', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-03');
    const body = (await res.json()) as JsonNight;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('keeps the valid rows and counts the bad line', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-04');
    const body = (await res.json()) as JsonNight;
    expect(res.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'notes/backup']);
    expect(body.badLines).toBe(1);
  });
});
