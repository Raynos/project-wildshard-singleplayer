/** The same-origin error inbox remains usable when Sentry is blocked or unreachable. */
import { ErrorReporter, sendReport } from '../core/errorReport';

export function reportBootInterruption(error: Error, build: string, diagnostic: string): void {
  let local: Storage | null = null;
  try { local = localStorage; } catch { /* reporting still works without offline persistence */ }
  const reporter = new ErrorReporter({
    send: sendReport, local,
    context: () => ({ build, shard: 'nine-dragon-stack', bootDiagnostic: diagnostic }),
  });
  // Fatal here means immediate delivery, not a visible modal. Failed sends use the existing offline queue.
  void reporter.report('boot-abrupt', error, { fatal: true });
}
