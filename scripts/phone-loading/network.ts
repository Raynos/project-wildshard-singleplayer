import type {Request} from 'playwright';
import type {ErrorRow, RequestAccounting, RequestRow} from './model.ts';

const ACCOUNTING_DEADLINE_MS = 5000;
interface Job {row: RequestRow; stage: string; active: boolean; done: Promise<void>}
function measured(value: unknown): value is number {return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;}
/** Native encoded transfer can be zero/-1 for SW/cache/blob responses, and
 * Playwright subtracts response-header estimates even then (or after a 304).
 * Preserve unknown fields and their raw values; never substitute decoded
 * bodies, Content-Length, zero, or another redirect hop's measurements. */
function accountSizes(row: RequestRow, body: unknown, headers: unknown): void {
  row.nativeSizes = {responseBodySize: typeof body === 'number' && Number.isFinite(body) ? body : null,
    responseHeadersSize: typeof headers === 'number' && Number.isFinite(headers) ? headers : null};
  if (measured(body)) row.bytes = body;
  if (measured(headers)) row.headerBytes = headers;
  const reasons: string[] = [];
  for (const [field, value] of [['response-body', body], ['response-headers', headers]] as const) {
    if (measured(value)) continue;
    if (value === undefined || value === null) reasons.push(`${field}-missing`);
    else if (typeof value === 'number' && Number.isSafeInteger(value) && value < 0) reasons.push(`${field}-negative`);
    else throw new Error(`Invalid native request sizes: body=${String(body)}, headers=${String(headers)}`);
  }
  if (reasons.length > 0) {
    row.sizeBasis = 'unavailable'; row.accounting = 'unavailable'; row.sizeUnavailable = reasons;
  } else {row.sizeBasis = 'native-encoded'; row.accounting = 'complete';}
}
/** One context owns one request ledger, across both visits and their gap.
 * Native response/size metadata cannot hold the measured visit indefinitely. */
export function observeRequests(attach: (start: (request: Request) => void, finish: (request: Request) => void) => () => void): {
  readonly rows: RequestRow[]; readonly errors: ErrorRow[]; settle: (since?: number) => Promise<RequestAccounting>; stop: () => void;
} {
  const rows: RequestRow[] = [], errors: ErrorRow[] = [], jobs = new Set<Job>();
  const starts = new Map<Request, RequestRow>();
  let stopped = false;
  const incomplete = (job: Job, reason: string): void => {
    if (!job.active) return;
    job.active = false; jobs.delete(job);
    job.row.accounting = 'incomplete'; job.row.accountingError = reason;
    errors.push({message: `Request accounting: ${reason}`, source: job.stage, url: job.row.url, at: Date.now()});
  };
  const start = (request: Request): void => {
    if (stopped) return;
    const row: RequestRow = {url: request.url(), start: request.timing().startTime > 0 ? request.timing().startTime : Date.now(),
      end: null, source: request.serviceWorker() !== null ? 'worker' : 'network', bytes: null, status: 0, failure: null, accounting: 'pending'};
    starts.set(request, row); rows.push(row);
  };
  const finish = (request: Request): void => {
    if (stopped) return;
    const row = starts.get(request);
    if (row === undefined) {
      errors.push({message: 'Request accounting: Error: Finished request without a start', source: 'requestfinished/requestfailed', url: request.url(), at: Date.now()});
      return;
    }
    if (row.end !== null) return;
    row.end = Date.now(); row.failure = request.failure()?.errorText ?? null;
    const job: Job = {row, stage: 'request.response', active: true, done: Promise.resolve()};
    jobs.add(job);
    job.done = (async () => {
      try {
        const response = await request.response();
        if (!job.active) return;
        row.source = request.serviceWorker() !== null ? 'worker' : response?.fromServiceWorker() ? 'service-worker' : 'network';
        row.status = response?.status() ?? 0;
        job.stage = 'request.sizes';
        const sizes = await request.sizes();
        if (!job.active) return;
        accountSizes(row, sizes.responseBodySize, sizes.responseHeadersSize);
        job.active = false;
      } catch (error) {incomplete(job, String(error));}
      finally {jobs.delete(job);}
    })();
  };
  const detach = attach(start, finish);
  return {rows, errors, settle: async (since = 0) => {
    const selected = [...jobs];
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (selected.length > 0) await Promise.race([Promise.all(selected.map(job => job.done)), new Promise<void>(resolve => {
        timer = setTimeout(resolve, ACCOUNTING_DEADLINE_MS);
      })]);
      const pending = selected.filter(job => job.active);
      for (const job of pending) incomplete(job, `Incomplete native ${job.stage} after ${ACCOUNTING_DEADLINE_MS}ms accounting deadline`);
      const incompleteRows = rows.filter(row => row.start >= since && row.accounting === 'incomplete');
      const unavailable = rows.filter(row => row.start >= since && row.accounting === 'unavailable').length;
      const inFlight = rows.filter(row => row.start >= since && row.end === null).length;
      const unknownByReason: Record<string, number> = {};
      for (const row of rows) if (row.start >= since) for (const reason of row.sizeUnavailable ?? [])
        unknownByReason[reason] = (unknownByReason[reason] ?? 0) + 1;
      return {complete: incompleteRows.length === 0, incomplete: incompleteRows.length,
        pending: pending.filter(job => job.row.start >= since).length, deadlineMs: ACCOUNTING_DEADLINE_MS,
        ...(unavailable === 0 ? {} : {unavailable, unknownByReason}), ...(inFlight === 0 ? {} : {inFlight})};
    } finally {if (timer !== undefined) clearTimeout(timer);}
  }, stop: () => {
    stopped = true; detach();
    for (const job of jobs) job.active = false;
    jobs.clear();
  }};
}
