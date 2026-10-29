import {afterEach, expect, test, vi} from 'vitest';
import type {Request, Response} from 'playwright';
import {legacyDouble} from '@wildshard/engine/test/FakeGame';
import {observeRequests} from '../scripts/phone-loading/network';

afterEach(() => {vi.useRealTimers();});
type Sizes = Awaited<ReturnType<Request['sizes']>>;
const sizes: Sizes = {requestBodySize: 0, requestHeadersSize: 0, responseBodySize: 4, responseHeadersSize: 2};
const response = (): Response => ({...legacyDouble<Response>({status: () => 200, fromServiceWorker: () => true})});
function fixture() {
  const events = new Map<string, (request: Request) => void>();
  const network = observeRequests((start, finish) => {
    events.set('start', start); events.set('finish', finish);
    return () => {events.clear();};
  });
  const request = (name: string, reply: () => Promise<Response | null>, size: () => Promise<Sizes>): Request => legacyDouble<Request>({
    url: () => `https://game.test/${name}`, serviceWorker: () => null, failure: () => null,
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
