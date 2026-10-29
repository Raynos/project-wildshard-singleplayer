import {afterEach, expect, test, vi} from 'vitest';
import type {Request, Response} from 'playwright';
import {legacyDouble} from '@wildshard/engine/test/FakeGame';
import {observeRequests} from '../scripts/phone-loading/network';

afterEach(() => {vi.useRealTimers();});
type Sizes = Awaited<ReturnType<Request['sizes']>>;
const sizes: Sizes = {requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 4, responseHeadersSize: 2};
const response = (): Response => ({...legacyDouble<Response>({status: () => 200, fromServiceWorker: () => true, headers: () => ({}), body: () => Promise.resolve(Buffer.alloc(4))})});
function fixture(native?: Parameters<typeof observeRequests>[1]) {
  const events = new Map<string, (request: Request) => void>();
  const network = observeRequests((start, finish) => {
    events.set('start', start); events.set('finish', finish);
    return () => {events.clear();};
  }, native);
  const request = (name: string, reply: () => Promise<Response | null>, size: () => Promise<Sizes>): Request => legacyDouble<Request>({
    url: () => name.includes(':') ? name : `https://game.test/${name}`, method: () => 'GET', serviceWorker: () => null, failure: () => null,
    timing: () => ({startTime: 100, domainLookupStart: 0, domainLookupEnd: 0, connectStart: 0, connectEnd: 0,
      secureConnectionStart: 0, requestStart: 0, responseStart: 0, responseEnd: 0}), response: reply, sizes: size,
  });
  const finish = (row: Request): void => {events.get('start')?.(row); events.get('finish')?.(row);};
  return {network, request, finish, events};
}

test('stalled native response and sizes refuse at one deadline, retaining unknown bytes and sealing late replies', async () => {
  vi.useFakeTimers();
  const {network, request, finish} = fixture();
  let respond: (value: Response) => void = () => {throw new Error('No response resolver');};
  let size: (value: Sizes) => void = () => {throw new Error('No sizes resolver');};
  const responseWait = new Promise<Response>(resolve => {respond = resolve;});
  const sizesWait = new Promise<Sizes>(resolve => {size = resolve;});
  try {
    finish(request('response-stall', () => responseWait, () => Promise.resolve(sizes)));
    finish(request('sizes-stall', () => Promise.resolve(response()), () => sizesWait));
    finish(request('known', () => Promise.resolve(response()), () => Promise.resolve(sizes)));
    const settled = network.settle();
    let completed = false; void settled.then(() => {completed = true; return completed;});
    await vi.advanceTimersByTimeAsync(4999); expect(completed).toBe(false);
    expect(network.rows.map(row => row.bytes)).toEqual([null, null, 4]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toEqual({complete: false, incomplete: 2, pending: 2, deadlineMs: 5000});
    expect(network.errors.map(row => [row.source, row.url])).toEqual([
      ['request.response', 'https://game.test/response-stall'], ['request.sizes', 'https://game.test/sizes-stall'],
    ]);
    expect(network.rows.map(row => row.accounting)).toEqual(['incomplete', 'incomplete', 'complete']);
    expect(network.rows.every(row => row.end !== null)).toBe(true);
    const sealed = JSON.stringify(network.rows);
    respond(response()); size(sizes); await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(network.rows)).toBe(sealed);
    expect(network.errors).toHaveLength(2);
    expect((await network.settle()).complete).toBe(false);
    expect(await network.settle(101)).toEqual({complete: true, incomplete: 0, pending: 0, deadlineMs: 5000});
    expect(vi.getTimerCount()).toBe(0);
  } finally {network.stop();}
});

test('a refused native size is unknown, while a measured zero remains an exact zero', async () => {
  const {network, request, finish} = fixture();
  try {
    finish(request('refused', () => Promise.resolve(response()), () => Promise.reject(new Error('Original native size refusal'))));
    finish(request('zero', () => Promise.resolve(response()), () => Promise.resolve({...sizes, responseBodySize: 0})));
    expect((await network.settle()).complete).toBe(false);
    expect(network.rows).toMatchObject([{bytes: null, accounting: 'incomplete', accountingError: 'Error: Original native size refusal'},
      {bytes: 0, headerBytes: 2, accounting: 'complete', status: 200, source: 'service-worker'}]);
    expect(network.errors).toHaveLength(1);
  } finally {network.stop();}
});

test('stop detaches listeners and prevents unresolved native jobs from mutating retained data', async () => {
  const {network, request, finish, events} = fixture();
  let respond: (value: Response) => void = () => {throw new Error('No response resolver');};
  const reply = new Promise<Response>(resolve => {respond = resolve;});
  finish(request('stopped', () => reply, () => Promise.resolve(sizes)));
  network.stop(); const before = JSON.stringify(network.rows);
  respond(response()); await Promise.resolve(); await Promise.resolve();
  expect(events.size).toBe(0); expect(network.errors).toEqual([]);
  expect(JSON.stringify(network.rows)).toBe(before);
});

test('zero-transfer cache and SW replies retain real decoded body sizes and raw native fields', async () => {
  const {network, request, finish} = fixture();
  try {
    finish(request('sw', () => Promise.resolve(response()), () => Promise.resolve({...sizes, responseBodySize: -379, responseHeadersSize: 379})));
    const cached: Response = {...legacyDouble<Response>({status: () => 200, fromServiceWorker: () => false, headers: () => ({}), body: () => Promise.resolve(Buffer.alloc(4))})};
    finish(request('disk-cache', () => Promise.resolve(cached), () => Promise.resolve({...sizes, responseBodySize: -97, responseHeadersSize: 97})));
    expect(await network.settle()).toEqual({complete: true, incomplete: 0, pending: 0, deadlineMs: 5000});
    expect(network.errors).toEqual([]);
    expect(network.rows).toMatchObject([
      {source: 'service-worker', bytes: 0, decodedBytes: 4, transferBytes: 0, headerBytes: 0, sizeBasis: 'native-encoded', nativeSizes: {responseBodySize: -379, responseHeadersSize: 379}},
      {source: 'network', bytes: 0, decodedBytes: 4, transferBytes: 0, headerBytes: 0, sizeBasis: 'native-encoded', nativeSizes: {responseBodySize: -97, responseHeadersSize: 97}},
    ]);
  } finally {network.stop();}
});

test('native events recover real cache/revalidation sizes even when Playwright fields are missing', async () => {
  const {network, request, finish} = fixture(() => ({requestId: 'native:1', transferBytes: 164, encodedBytes: 0, decodedBytes: 4600}));
  const absent = {...sizes}; Reflect.deleteProperty(absent, 'responseHeadersSize');
  try {
    finish(request('revalidated', () => Promise.resolve(response()), () => Promise.resolve({...sizes, responseBodySize: -352, responseHeadersSize: 516})));
    finish(request('missing', () => Promise.resolve(response()), () => Promise.resolve(absent)));
    expect(await network.settle()).toEqual({complete: true, incomplete: 0, pending: 0, deadlineMs: 5000});
    expect(network.rows).toMatchObject([{bytes: 0, decodedBytes: 4600, transferBytes: 164, headerBytes: 164, sizeBasis: 'native-events'},
      {bytes: 0, decodedBytes: 4600, transferBytes: 164, headerBytes: 164, sizeBasis: 'native-events'}]);
    expect(network.errors).toEqual([]);
  } finally {network.stop();}
});

test.each([
  {responseBodySize: Number.NaN, responseHeadersSize: 4},
  {responseBodySize: 4, responseHeadersSize: Number.POSITIVE_INFINITY}, {responseBodySize: 1.5, responseHeadersSize: 4},
])('malformed native size metadata still refuses: %j', async bad => {
  const {network, request, finish} = fixture();
  try {
    finish(request('malformed', () => Promise.resolve(response()), () => Promise.resolve({...sizes, ...bad})));
    expect((await network.settle()).complete).toBe(false);
    expect(network.errors).toMatchObject([{source: 'request.sizes', message: expect.stringContaining('Invalid native request sizes:')}]);
    expect(network.rows[0]?.accounting).toBe('incomplete');
  } finally {network.stop();}
});

test('compressed bytes and redirect hops retain their own sizes without decoded-body reads or URL deduplication', async () => {
  const {network, request, finish} = fixture();
  const redirect: Response = {...legacyDouble<Response>({status: () => 302, fromServiceWorker: () => false})};
  const compressed: Response = {...legacyDouble<Response>({status: () => 200, fromServiceWorker: () => false,
    headers: () => ({'content-encoding': 'gzip'}), body: () => Promise.resolve(Buffer.alloc(4600))})};
  try {
    finish(request('same-url', () => Promise.resolve(redirect), () => Promise.resolve({...sizes, responseBodySize: 0, responseHeadersSize: 77})));
    finish(request('same-url', () => Promise.resolve(compressed), () => Promise.resolve({...sizes, responseBodySize: 83, responseHeadersSize: 110})));
    expect((await network.settle()).complete).toBe(true);
    expect(network.rows.map(row => [row.status, row.bytes, row.headerBytes])).toEqual([[302, 0, 77], [200, 83, 110]]);
    expect(network.rows.map(row => row.decodedBytes)).toEqual([0, 4600]);
    expect(network.errors).toEqual([]);
  } finally {network.stop();}
});

test('unfinished requests remain counted with unknown bytes at the measurement boundary', async () => {
  const {network, request, events} = fixture();
  try {
    events.get('start')?.(request('still-fetching', () => Promise.resolve(response()), () => Promise.resolve(sizes)));
    expect(await network.settle()).toEqual({complete: true, incomplete: 0, pending: 0, deadlineMs: 5000, inFlight: 1});
    expect(network.rows).toMatchObject([{bytes: null, end: null, accounting: 'pending'}]);
    expect(network.errors).toEqual([]);
  } finally {network.stop();}
});

test('a late body reply cannot rewrite a sealed native accounting timeout', async () => {
  vi.useFakeTimers();
  const {network, request, finish} = fixture(() => ({requestId: 'body-wait', encodedBytes: 0, transferBytes: 0}));
  let deliverBody: (bytes: Buffer) => void = () => {throw new Error('Body resolver missing');};
  const body = new Promise<Buffer>(resolve => {deliverBody = resolve;});
  const pendingResponse: Response = {...legacyDouble<Response>({status: () => 200, fromServiceWorker: () => true,
    headers: () => ({}), body: () => body})};
  try {
    finish(request('late-body', () => Promise.resolve(pendingResponse), () => Promise.resolve({...sizes, responseBodySize: -2})));
    const settled = network.settle(); await vi.advanceTimersByTimeAsync(5000);
    expect(await settled).toMatchObject({complete: false, incomplete: 1, pending: 1});
    expect(network.errors).toMatchObject([{source: 'response.body'}]);
    const sealed = JSON.stringify(network.rows); deliverBody(Buffer.alloc(400)); await vi.advanceTimersByTimeAsync(0);
    expect(JSON.stringify(network.rows)).toBe(sealed);
  } finally {network.stop();}
});
