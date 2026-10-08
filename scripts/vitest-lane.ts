import { parseCLI } from 'vitest/node';
import { assertHeavyLease } from './heavy-lane-lease.mjs';

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
