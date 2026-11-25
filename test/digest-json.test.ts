import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest JSON', () => {
  it('lists the same jobs, in the same order, as the page', async () => {
    const app = createApp(config);
    const json = await app.request('/api/digest/2026-10-28');
    const page = await app.request('/digest/2026-10-28');
    const { rows } = (await json.json()) as { rows: { job: string }[] };
    const html = await page.text();
    const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? '';
    const pageJobs = [...body.matchAll(/<tr>\s*<td>([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(json.status).toBe(200);
    expect(pageJobs.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.job)).toEqual(pageJobs);
  });
});
