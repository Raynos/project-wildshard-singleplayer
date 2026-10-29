// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { ContentReadError, readContent } from './contentRead';
import { loadingWaitState } from './download';

const url = 'https://example.test/shardfiles/island/shape.bin';
const immediate = (): Promise<void> => Promise.resolve();

test('a dropped connection retries once with cache reload and returns exact bytes', async () => {
  const calls: RequestInit[] = [];
  let delays = 0;
  const bytes = await readContent(url, 3, { fetch: (_url, init) => {
    calls.push(init);
    return calls.length === 1 ? Promise.reject(new TypeError('Synthetic connection lost')) : Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
  }, delay: () => { delays++; return Promise.resolve(); } });
  expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
  expect(calls.map(call => call.cache)).toEqual([undefined, 'reload']); expect(delays).toBe(1);
});

test('an interrupted body is discarded before retrying the complete file', async () => {
  let calls = 0, pulls = 0;
  const progress: number[] = [];
  const bytes = await readContent(url, 3, { fetch: () => {
    calls++;
    return Promise.resolve(calls === 1 ? new Response(new ReadableStream<Uint8Array>({ pull(controller) {
      if (++pulls === 1) controller.enqueue(new Uint8Array([9]));
      else controller.error(new TypeError('Synthetic body disconnected'));
    } }, { highWaterMark: 0 })) : new Response(new Uint8Array([1, 2, 3])));
  }, delay: immediate, read: size => { progress.push(size); } });
  expect(bytes).toEqual(new Uint8Array([1, 2, 3])); expect(calls).toBe(2);
  expect(progress).toEqual([1, 3]);
});

test.each(['text/html;charset=utf-8', 'application/octet-stream'])('HTML missing-file answers (%s) never reach the parser', async type => {
  let calls = 0;
  const failure = await readContent(url, 256, { fetch: () => {
    calls++; return Promise.resolve(new Response('\uFEFF <!doctype html><html>Missing</html>', { headers: { 'content-type': type } }));
  }, delay: immediate, retry: error => { throw error; } }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(ContentReadError);
  expect(failure).toHaveProperty('message', expect.stringContaining('/shardfiles/island/shape.bin'));
  expect(failure).toHaveProperty('message', expect.stringContaining('HTML')); expect(calls).toBe(2);
});

test('exhausted transport stays pending on the existing RETRY and resumes in place', async () => {
  let calls = 0;
  let retryOffered = (): void => { throw new Error('Missing retry observer'); };
  const offered = new Promise<void>(resolve => { retryOffered = resolve; });
  const pending = readContent(url, 3, { fetch: () => {
    calls++;
    if (calls === 2) retryOffered();
    return Promise.resolve(calls <= 2 ? new Response(null, { status: 503 }) : new Response(new Uint8Array([1, 2, 3])));
  }, delay: immediate });
  await offered;
  await vi.waitFor(() => { expect([...loadingWaitState().pending.values()].some(row => row.resource === url)).toBe(true); });
  const wait = [...loadingWaitState().pending.values()].find(row => row.resource === url);
  expect(wait?.deadlineMs).toBe(0); expect(wait?.label).toContain('HTTP 503');
  if (wait?.retry === null || wait?.retry === undefined) throw new Error('Missing existing loading-card RETRY');
  wait.retry(); expect(await pending).toEqual(new Uint8Array([1, 2, 3]));
  expect(calls).toBe(3); expect(loadingWaitState().pending.has(wait.id)).toBe(false);
});

test('cancellation and oversized content keep their original refusal without retry', async () => {
  const controller = new AbortController(), reason = new Error('Original owner retired'); controller.abort(reason);
  let calls = 0;
  const fetch = (): Promise<Response> => { calls++; return Promise.resolve(new Response(new Uint8Array([1, 2]))); };
  await expect(readContent(url, 2, { fetch, signal: controller.signal })).rejects.toBe(reason);
  expect(calls).toBe(0);
  await expect(readContent(url, 1, { fetch, delay: immediate })).rejects.toThrow('wire size exceeds cap');
  expect(calls).toBe(1);
});

test('cancelling a suspended RETRY drains its wait without restarting transport', async () => {
  const controller = new AbortController(), reason = new Error('Read owner retired');
  let offered = (): void => { throw new Error('Missing retry observer'); };
  const ready = new Promise<void>(resolve => { offered = resolve; });
  let calls = 0;
  const pending = readContent(url, 2, { fetch: () => {
    calls++; if (calls === 2) offered(); return Promise.reject(new TypeError('Connection absent'));
  }, delay: immediate, signal: controller.signal });
  await ready;
  await vi.waitFor(() => { expect([...loadingWaitState().pending.values()].some(row => row.resource === url)).toBe(true); });
  controller.abort(reason); await expect(pending).rejects.toBe(reason);
  expect(calls).toBe(2); expect([...loadingWaitState().pending.values()].some(row => row.resource === url)).toBe(false);
});
