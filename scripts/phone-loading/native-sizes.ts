import type {Request} from 'playwright';
import {record} from './model.ts';

export interface NativeSizes {decodedBytes?: number; encodedBytes?: number; transferBytes?: number; requestId: string; partial?: boolean; readBody?: () => Promise<number>}
interface Entry {
  key: string; session: string; protocolId: string; seenData: Set<string>; worker: boolean; url: string; method: string; start: number; timestamp?: number; timedStart?: number;
  decoded: number; encoded: number; chunks: boolean; cached: boolean; sw: boolean;
  initial?: number; transfer?: number; complete: boolean; revalidated?: boolean; failed?: boolean;
}
function size(value: unknown): value is number {return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;}
/** Passive CDP ledger. Redirect hops keep separate entries; matching requires
 * URL, method, owner kind and the native request's own wall-clock start. */
export class NativeSizeLedger {
  constructor(private readonly bodyReader?: (session: string, id: string) => Promise<number>) {}
  private readonly active = new Map<string, Entry>();
  private readonly entries: Entry[] = [];
  private readonly requests = new WeakMap<Request, Entry>();
  private readonly claimed = new Set<Entry>();
  event(session: string, worker: boolean, method: string, input: unknown): void {
    const data = record(input), id = data['requestId'];
    if (typeof id !== 'string') return;
    const key = `${session}:${id}`;
    if (method === 'Network.requestWillBeSent') {
      const previous = this.active.get(key), redirect = record(data['redirectResponse']);
      if (previous !== undefined && data['redirectResponse'] !== undefined) {
        if (size(redirect['encodedDataLength'])) previous.transfer = redirect['encodedDataLength'];
        previous.complete = true;
      }
      const request = record(data['request']), url = request['url'], verb = request['method'], wall = data['wallTime'];
      if (typeof url !== 'string' || typeof verb !== 'string' || typeof wall !== 'number' || !Number.isFinite(wall)) return;
      const migrated = this.entries.find(row => row.protocolId === id && row.url === url && row.method === verb && row.worker === worker && Math.abs(row.start - wall * 1000) < 0.001);
      if (migrated !== undefined) {this.active.set(key, migrated); return;}
      const entry: Entry = {key: `${key}:${this.entries.length}`, session, protocolId: id, seenData: new Set(), worker, url, method: verb, start: wall * 1000,
        decoded: 0, encoded: 0, chunks: false, cached: false, sw: false, complete: false};
      if (typeof data['timestamp'] === 'number') entry.timestamp = data['timestamp'];
      this.entries.push(entry); this.active.set(key, entry); return;
    }
    const entry = this.active.get(key); if (entry === undefined) return;
    entry.session = session;
    if (method === 'Network.responseReceived') {
      const response = record(data['response']);
      entry.cached ||= response['fromDiskCache'] === true || response['fromPrefetchCache'] === true;
      entry.sw = response['fromServiceWorker'] === true;
      if (size(response['encodedDataLength'])) entry.initial = response['encodedDataLength'];
      const timing = record(response['timing']), requestTime = timing['requestTime'];
      // Playwright uses response.requestTime, not requestWillBeSent.wallTime,
      // whenever network timing is available. Retain both native bases.
      if (typeof requestTime === 'number' && Number.isFinite(requestTime) && entry.timestamp !== undefined)
        entry.timedStart = entry.start + (requestTime - entry.timestamp) * 1000;
    } else if (method === 'Network.responseReceivedExtraInfo') {
      entry.revalidated = data['statusCode'] === 304;
    } else if (method === 'Network.requestServedFromCache') entry.cached = true;
    else if (method === 'Network.dataReceived') {
      if (typeof data['timestamp'] === 'number') {
        const token = `${data['timestamp']}:${String(data['dataLength'])}:${String(data['encodedDataLength'])}`;
        if (entry.seenData.has(token)) return; entry.seenData.add(token);
      }
      if (size(data['dataLength'])) {entry.decoded += data['dataLength']; entry.chunks = true;}
      if (size(data['encodedDataLength'])) entry.encoded += data['encodedDataLength'];
    } else if (method === 'Network.loadingFailed') {
      entry.failed = true; entry.complete = true;
      entry.transfer = (entry.initial ?? 0) + entry.encoded;
    } else if (method === 'Network.loadingFinished') {
      if (size(data['encodedDataLength'])) entry.transfer = data['encodedDataLength'];
      // A blob/data URL reads local content; it performs no network transfer.
      else if (/^(?:blob|data):/u.test(entry.url)) entry.transfer = 0;
      entry.complete = true;
    }
  }
  read(request: Request): NativeSizes | null {
    let entry = this.requests.get(request);
    if (entry === undefined) {
      const start = request.timing().startTime, worker = request.serviceWorker() !== null;
      const distance = (row: Entry): number => Math.min(Math.abs(row.start - start), Math.abs((row.timedStart ?? row.start) - start));
      const candidates = this.entries.filter(row => !this.claimed.has(row) && row.url === request.url() && row.method === request.method()
        && row.worker === worker && distance(row) < 1).sort((a, b) => distance(a) - distance(b));
      const first = candidates[0], second = candidates[1];
      if (first === undefined || (second !== undefined && distance(first) === distance(second))) return null;
      entry = first; this.claimed.add(entry); this.requests.set(request, entry);
    }
    if (!entry.complete) return null;
    let encoded: number | undefined;
    if (entry.failed) encoded = entry.encoded;
    else if (entry.transfer === 0 || entry.revalidated) encoded = 0;
    else if (entry.transfer !== undefined && entry.initial !== undefined && entry.transfer >= entry.initial) encoded = entry.transfer - entry.initial;
    else if (entry.encoded > 0) encoded = entry.encoded;
    const reader = this.bodyReader, selected = entry;
    return {requestId: entry.key, ...(reader === undefined ? {} : {readBody: () => reader(selected.session, selected.protocolId)}),
      ...(entry.failed ? {partial: true} : {}), ...((entry.chunks || entry.failed) ? {decodedBytes: entry.decoded} : {}),
      ...(encoded === undefined ? {} : {encodedBytes: encoded}), ...(entry.transfer === undefined ? {} : {transferBytes: entry.transfer})};
  }
}
