import type {Request} from 'playwright';
import type {ErrorRow, RequestRow} from './model.ts';

/** One context owns one request ledger, across both visits and their gap. */
export function observeRequests(attach: (start: (request: Request) => void, finish: (request: Request) => void) => () => void): {
  readonly rows: RequestRow[]; readonly errors: ErrorRow[]; settle: () => Promise<void>; stop: () => void;
} {
  const rows: RequestRow[] = [], errors: ErrorRow[] = [], jobs: Promise<void>[] = [];
  const starts = new Map<Request, RequestRow>();
  const start = (request: Request): void => {
    const row: RequestRow = {url: request.url(), start: request.timing().startTime > 0 ? request.timing().startTime : Date.now(),
      end: null, source: request.serviceWorker() !== null ? 'worker' : 'network', bytes: 0, status: 0, failure: null};
    starts.set(request, row); rows.push(row);
  };
  const finish = (request: Request): void => {
    jobs.push((async () => {
      try {
        const response = await request.response(), sizes = await request.sizes().catch(() => null);
        const row = starts.get(request);
        if (row === undefined) throw new Error('Finished request without a start');
        row.end = Date.now(); row.source = request.serviceWorker() !== null ? 'worker' : response?.fromServiceWorker() ? 'service-worker' : 'network';
        row.bytes = Math.max(0, sizes?.responseBodySize ?? 0); row.headerBytes = sizes?.responseHeadersSize ?? 0;
        row.status = response?.status() ?? 0; row.failure = request.failure()?.errorText ?? null;
      } catch (error) {errors.push({message: `Request accounting: ${String(error)}`, source: 'requestfinished/requestfailed', url: request.url(), at: Date.now()});}
    })());
  };
  const stop = attach(start, finish);
  return {rows, errors, settle: async () => {await Promise.all(jobs);}, stop};
}
