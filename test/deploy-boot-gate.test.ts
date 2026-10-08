import { expect, it } from 'vitest';
import { bootGreen, logProvesProduction, newestCiGreen, productionLive } from '../scripts/deploy-pin.mjs';

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
  expect(newestCiGreen(query)).toBe(b);
  expect(calls).toHaveLength(3);
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
