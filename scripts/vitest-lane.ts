import { parseCLI } from 'vitest/node';
import { assertHeavyLease } from './heavy-lane-lease.mjs';

/** Local tests leave cores for interactive work; CI retains Vitest's runner default. */
export function vitestMaxWorkers(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const { WS_VITEST_MAX_WORKERS: requested, CI: ci, GITHUB_ACTIONS: actions } = env;
  if (requested === undefined) return ci || actions ? undefined : 6;
  if (!/^[1-9]\d*$/u.test(requested) || !Number.isSafeInteger(Number(requested))) {
    throw new Error('WS_VITEST_MAX_WORKERS must be a positive integer');
  }
  return Number(requested);
}

/** Use Vitest's parser so flag values cannot masquerade as focused file filters. */
export function isFullVitest(argv: readonly string[]): boolean {
  if (argv[0] === 'list' || argv[0] === 'init' || argv[0] === 'complete' || argv.some(arg => /^(?:--help|-h|--version|-v|--mergeReports|--merge-reports|--listTags|--list-tags|--clearCache|--clear-cache)(?:=|$)/u.test(arg))) return false;
  const parsed = parseCLI(['vitest', ...argv]);
  if (parsed.filter.length === 0) return true;
  return parsed.filter.some(filter => {
    const base = filter.replaceAll('\\', '/').replaceAll(/[*?{}[\]]/gu, '').replace(/\.test\.[cm]?[jt]sx?$/u, '').replace(/\/+$/u, '').replace(/^\.\//u, '');
    return base === '' || base === '.' || base === 'test' || base === 'api-tests' || base === 'drafts/test';
  });
}

/** A full run must hold the machine lane before Vitest starts any worker pool. */
export function assertVitestLane(argv: readonly string[] = process.argv.slice(2)): void {
  if (isFullVitest(argv)) assertHeavyLease('full-test');
}
