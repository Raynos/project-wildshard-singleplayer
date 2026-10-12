import { expect, it } from 'vitest';
import { ciGreen, bootGreen, logProvesProduction, newestCiGreen, newestCiGreenAfterBoot, PendingBootSmokeError, productionLive, releaseReady, releaseSlot } from '../scripts/deploy-pin.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
const lines: string[] = [];
const record = (line: string) => { lines.push(line); };
function fixture(statuses: Record<string, string>, candidates = `${a}\n${b}\n${c}`) {
  const calls: string[] = [];
  const query = (args: string[]): string => {
    const endpoint = args[0] ?? ''; calls.push(endpoint);
    if (endpoint.includes('/actions/workflows/deploy.yml/')) {
      expect(endpoint).toContain('branch=main&event=push&status=success');
      return candidates.split('\n').map(sha => `${sha}\t2026-10-01T00:00:00Z`).join('\n');
    }
    const sha = /\/commits\/([a-f0-9]{40})\/status$/u.exec(endpoint)?.[1];
    if (sha === undefined) throw new Error(`unexpected query ${endpoint}`);
    return statuses[sha] ?? '';
  };
  return { query, calls };
}

it('holds selection while a newer exact-SHA boot is pending, even with an older proven build', () => {
  const { query, calls } = fixture({ [a]: 'boot-smoke\tpending\tqueued', [b]: 'boot-smoke\tsuccess\tgameplay passed' });
  expect(() => newestCiGreen(query)).toThrow(PendingBootSmokeError);
  expect(calls).toHaveLength(2);
});

it('waits in the same release and selects the newer SHA only after its proof succeeds', async () => {
  const status = { [a]: 'boot-smoke\tpending\tqueued', [b]: 'boot-smoke\tsuccess\tpassed' };
  const { query } = fixture(status);
  let now = 0;
  expect(await newestCiGreenAfterBoot(query, record, { now: () => now, wait: (ms) => {
    now += ms; status[a] = 'boot-smoke\tsuccess\tpassed'; return Promise.resolve();
  } })).toBe(a);
  expect(now).toBe(30000);
});

it('allows fallback after a terminal smoke failure but refuses a still-pending proof at the deadline', async () => {
  const status = { [a]: 'boot-smoke\tpending\tqueued', [b]: 'boot-smoke\tsuccess\tpassed' };
  const { query } = fixture(status);
  let now = 0;
  expect(await newestCiGreenAfterBoot(query, record, { now: () => now, wait: (ms) => {
    now += ms; status[a] = 'boot-smoke\tfailure\tfatal'; return Promise.resolve();
  } })).toBe(b);
  status[a] = 'boot-smoke\tpending\tqueued'; now = 0;
  await expect(newestCiGreenAfterBoot(query, record, { now: () => now, maxWaitMs: 60000,
    wait: (ms) => { now += ms; return Promise.resolve(); } })).rejects.toThrow('still unresolved after wait');
  expect(now).toBe(60000);
});

it('holds a newly green push before smoke publishes its first exact-SHA status', () => {
  const now = Date.parse('2026-10-11T13:00:00Z');
  const base = fixture({ [b]: 'boot-smoke\tsuccess\tpassed' }, `${a}\n${b}`).query;
  const query = (args: string[]) => (args[0] ?? '').includes('/workflows/')
    ? `${a}\t2026-10-11T12:59:00Z\n${b}\t2026-10-01T00:00:00Z` : base(args);
  expect(() => newestCiGreen(query, record, now)).toThrow(PendingBootSmokeError);
  expect(newestCiGreen(query, record, now + 15 * 60000)).toBe(b);
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

it('defers an older smoke completion without starting a release while a newer exact proof is pending', () => {
  const status = { [a]: 'boot-smoke\tpending\tqueued', [b]: 'boot-smoke\tsuccess\tpassed' };
  const { query, calls } = fixture(status);
  expect(releaseReady(query, record)).toEqual({ ready: false, sha: a });
  expect(calls).toHaveLength(2);
  status[a] = 'boot-smoke\tsuccess\tpassed';
  expect(releaseReady(query, record)).toEqual({ ready: true, sha: a });
});

it('keeps readiness closed during the newly-green status publication gap', () => {
  const now = Date.parse('2026-10-11T13:00:00Z');
  const base = fixture({ [b]: 'boot-smoke\tsuccess\tpassed' }, `${a}\n${b}`).query;
  const query = (args: string[]) => (args[0] ?? '').includes('/workflows/')
    ? `${a}\t2026-10-11T12:59:00Z\n${b}\t2026-10-01T00:00:00Z` : base(args);
  expect(releaseReady(query, record, now)).toEqual({ ready: false, sha: a });
});

it('readiness keeps terminal fallback and refuses API or malformed proof errors', () => {
  expect(releaseReady(fixture({ [a]: 'boot-smoke\tfailure\tfatal', [b]: 'boot-smoke\tsuccess\tpassed' }).query, record))
    .toEqual({ ready: true, sha: b });
  expect(() => releaseReady(() => { throw new Error('API unavailable'); }, record)).toThrow('API unavailable');
  expect(() => releaseReady(fixture({}, 'not-a-sha').query, record)).toThrow();
});
