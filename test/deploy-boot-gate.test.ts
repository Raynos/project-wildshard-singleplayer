import { expect, it } from 'vitest';
import { ciGreen, bootGreen, logProvesProduction, newestCiGreen, productionLive, releaseSlot } from '../scripts/deploy-pin.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
function fixture(statuses: Record<string, string>, candidates = `${a}\n${b}\n${c}`) {
  const calls: string[] = [];
  const query = (args: string[]): string => {
    const endpoint = args[0] ?? ''; calls.push(endpoint);
    if (endpoint.includes('/actions/workflows/deploy.yml/')) {
      expect(endpoint).toContain('branch=main&event=push&status=success');
      return candidates;
    }
    const sha = /\/commits\/([a-f0-9]{40})\/status$/u.exec(endpoint)?.[1];
    if (sha === undefined) throw new Error(`unexpected query ${endpoint}`);
    return statuses[sha] ?? '';
  };
  return { query, calls };
}

it('selects the newest intersection of main push-CI and exact-SHA boot successes', () => {
  const { query, calls } = fixture({ [a]: 'boot-smoke\tpending\tqueued', [b]: 'boot-smoke\tsuccess\tgameplay passed' });
  const lines: string[] = [];
  expect(newestCiGreen(query, (line: string) => { lines.push(line); })).toBe(b);
  expect(calls).toHaveLength(3);
  expect(lines).toEqual([`newest-ci-green: skipped ${a.slice(0, 9)}: push CI green, boot-smoke pending (queued)`]);
});

it('refuses missing/failing smoke even when push CI is green, without accepting a neighbour SHA', () => {
  const { query } = fixture({ [a]: 'boot-smoke\tfailure\tfatal', [c]: 'boot-smoke\tsuccess\tpassed' }, `${a}\n${b}`);
  expect(() => newestCiGreen(query)).toThrow('no successful push CI with a successful exact-SHA boot-smoke');
});

it('uses the latest status for repeated runs and refuses newer pending or failed boots', () => {
  for (const state of ['failure', 'pending']) {
    const { query } = fixture({ [a]: `boot-smoke\t${state}\tnew\nboot-smoke\tsuccess\told` });
    expect(bootGreen(a, query)).toBe(false);
  }
  expect(bootGreen(a, fixture({ [a]: 'boot-smoke\tsuccess\tnew\nboot-smoke\tfailure\told' }).query)).toBe(true);
});

it('refuses malformed and empty CI responses instead of guessing a release', () => {
  expect(() => newestCiGreen(fixture({}, 'not-a-sha').query)).toThrow();
  expect(() => newestCiGreen(fixture({}, '').query)).toThrow();
  expect(() => bootGreen('main', fixture({}).query)).toThrow('exact 40-hex SHA');
});

it('requires exact historical production evidence, rather than pin history or a deploy attempt', () => {
  const log = `2026-10-08T09:07:59Z DEPLOY_SHA: ${a}\n2026-10-08T09:08:00Z Production ${a.slice(0, 7)}-build; target ${a.slice(0, 7)}; match true`;
  expect(logProvesProduction(a, log)).toBe(true);
  expect(logProvesProduction(b, log)).toBe(false);
  expect(logProvesProduction(a, log.replace('match true', 'match false'))).toBe(false);
  expect(logProvesProduction(a, log.replace(`DEPLOY_SHA: ${a}`, `deployed https://example.com for ${a}`))).toBe(false);
  expect(logProvesProduction(a, `${log}\nDEPLOY_SHA: ${b}`)).toBe(false);
  expect(logProvesProduction(a, log.replace(`Production ${a.slice(0, 7)}`, `Production ${b.slice(0, 7)}`))).toBe(false);
});

it('allows rollback to a previously live pre-smoke SHA without requiring pin history', () => {
  const calls: string[] = [];
  const query = (args: string[]): string => {
    const endpoint = args[0] ?? ''; calls.push(endpoint);
    if (endpoint.includes('/commits/')) return '';
    if (endpoint.includes('/workflows/')) return '123';
    if (endpoint.endsWith('/runs/123/jobs')) return '456';
    if (endpoint.endsWith('/jobs/456/logs')) return `DEPLOY_SHA: ${a}\nProduction aaaaaaa-build; target aaaaaaa; match true`;
    throw new Error(`Unexpected query ${endpoint}`);
  };
  expect(productionLive(a, query)).toBe(true);
  expect(calls).toHaveLength(4);
  expect(productionLive(a, fixture({ [a]: 'production-live\tsuccess\tverified' }).query)).toBe(true);
});

it('refuses never-shipped SHAs and expired historical evidence', () => {
  const query = (args: string[]): string => {
    const endpoint = args[0] ?? '';
    if (endpoint.includes('/commits/')) return 'boot-smoke\tfailure\tfatal';
    if (endpoint.includes('/workflows/')) return '123';
    if (endpoint.endsWith('/jobs')) return '456';
    if (endpoint.endsWith('/logs')) throw new Error('Logs expired');
    throw new Error(`Unexpected query ${endpoint}`);
  };
  expect(productionLive(a, query)).toBe(false);
  expect(() => productionLive('main', query)).toThrow('exact 40-hex SHA');
});

it('reuses complete push CI only for an exact main SHA, refusing missing or neighbouring results', () => {
  const query = (result: string) => (args: string[]): string => {
    expect(args[0]).toContain(`branch=main&event=push&status=success&head_sha=${a}&per_page=1`);
    return result;
  };
  expect(ciGreen(a, query(a))).toBe(true);
  for (const result of ['', b, 'not-a-sha']) expect(ciGreen(a, query(result))).toBe(false);
  expect(() => ciGreen('main', query(a))).toThrow('exact 40-hex SHA');
});

it('frees the hourly release slot only when no release run started in the last hour and none is live (G284)', () => {
  const now = Date.parse('2026-10-09T21:00:00Z');
  const slot = (rows: Record<string, string>) => releaseSlot(now, (args: string[]): string => {
    const endpoint = args[0] ?? '';
    expect(endpoint).toMatch(/actions\/workflows\/deploy\.yml\/runs\?event=(schedule|workflow_dispatch)&per_page=10$/u);
    return rows[endpoint.includes('event=schedule') ? 'schedule' : 'dispatch'] ?? '';
  });
  expect(slot({ schedule: '1\tcompleted\t2026-10-09T19:17:00Z', dispatch: '2\tcompleted\t2026-10-09T19:40:00Z' }).free).toBe(true);
  expect(slot({}).free).toBe(true);
  expect(slot({ schedule: '1\tcompleted\t2026-10-09T20:17:00Z' })).toEqual({ free: false, why: 'schedule run 1 started 43 min ago' });
  expect(slot({ dispatch: '2\tqueued\t2026-10-09T18:00:00Z' })).toEqual({ free: false, why: 'workflow_dispatch run 2 is queued' });
  expect(slot({ dispatch: '2\tin_progress\t2026-10-09T19:30:00Z' }).free).toBe(false);
  expect(() => slot({ schedule: 'garbage' })).toThrow('unreadable run row');
});
