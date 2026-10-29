import {expect, test} from 'vitest';
import type {Request} from 'playwright';
import {legacyDouble} from '@wildshard/engine/test/FakeGame';
import {NativeSizeLedger} from '../scripts/phone-loading/native-sizes';

function request(url: string, start = 1000, worker = false): Request {
  return legacyDouble<Request>({url: () => url, method: () => 'GET',
    timing: () => legacyDouble<ReturnType<Request['timing']>>({startTime: start}),
    serviceWorker: () => worker ? legacyDouble<NonNullable<ReturnType<Request['serviceWorker']>>>({}) : null});
}
function begin(ledger: NativeSizeLedger, url: string, id = '1', wallTime = 1, worker = false): void {
  ledger.event('session', worker, 'Network.requestWillBeSent', {requestId: id, wallTime, request: {url, method: 'GET'}});
}
test('real native decoded bodies remain separate from compressed and cached wire bytes', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/gzip'; begin(ledger, url);
  ledger.event('session', false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 176}});
  ledger.event('session', false, 'Network.dataReceived', {requestId: '1', dataLength: 4600, encodedDataLength: 70});
  ledger.event('session', false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 246});
  expect(ledger.read(request(url))).toMatchObject({decodedBytes: 4600, encodedBytes: 70, transferBytes: 246});
  begin(ledger, url, '2', 2);
  ledger.event('session', false, 'Network.responseReceived', {requestId: '2', response: {encodedDataLength: 0, fromDiskCache: true}});
  ledger.event('session', false, 'Network.dataReceived', {requestId: '2', dataLength: 4600, encodedDataLength: 0});
  ledger.event('session', false, 'Network.loadingFinished', {requestId: '2', encodedDataLength: 0});
  expect(ledger.read(request(url, 2000))).toMatchObject({decodedBytes: 4600, encodedBytes: 0, transferBytes: 0});
});
test('local blob transfer sentinel and SW responses retain actual delivered bodies', () => {
  const ledger = new NativeSizeLedger();
  for (const [url, sw] of [['blob:https://game.test/native', false], ['https://game.test/sw', true]] as const) {
    begin(ledger, url, url);
    ledger.event('session', false, 'Network.responseReceived', {requestId: url, response: {encodedDataLength: -1, fromServiceWorker: sw}});
    ledger.event('session', false, 'Network.dataReceived', {requestId: url, dataLength: 19, encodedDataLength: 0});
    ledger.event('session', false, 'Network.loadingFinished', {requestId: url, encodedDataLength: sw ? 0 : -1});
    expect(ledger.read(request(url))).toMatchObject({decodedBytes: 19, encodedBytes: 0, transferBytes: 0});
  }
});
test('redirects and simultaneous worker/page requests never merge by URL', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/shared'; begin(ledger, url);
  ledger.event('session', false, 'Network.requestWillBeSent', {requestId: '1', wallTime: 2,
    request: {url, method: 'GET'}, redirectResponse: {encodedDataLength: 151}});
  ledger.event('session', false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 100}});
  ledger.event('session', false, 'Network.dataReceived', {requestId: '1', dataLength: 25, encodedDataLength: 25});
  ledger.event('session', false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 125});
  begin(ledger, url, 'worker', 2, true);
  ledger.event('session', true, 'Network.responseReceived', {requestId: 'worker', response: {encodedDataLength: 80}});
  ledger.event('session', true, 'Network.dataReceived', {requestId: 'worker', dataLength: 4, encodedDataLength: 4});
  ledger.event('session', true, 'Network.loadingFinished', {requestId: 'worker', encodedDataLength: 84});
  expect(ledger.read(request(url))).toMatchObject({transferBytes: 151});
  expect(ledger.read(request(url, 2000))).toMatchObject({transferBytes: 125, decodedBytes: 25});
  expect(ledger.read(request(url, 2000, true))).toMatchObject({transferBytes: 84, decodedBytes: 4});
});
test('unmatched, unfinished or ambiguous native identities never grant another request bytes', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/ambiguous'; begin(ledger, url);
  expect(ledger.read(request(url, 5000))).toBeNull();
  const active = request(url); expect(ledger.read(active)).toBeNull();
  ledger.event('session', false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 0});
  expect(ledger.read(active)).toMatchObject({transferBytes: 0, encodedBytes: 0});
  begin(ledger, url, '2', 2); begin(ledger, url, '3', 2);
  expect(ledger.read(request(url, 2000))).toBeNull();
});
test('network timing uses Playwright response requestTime without weakening native identity matching', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/timed';
  ledger.event('s', false, 'Network.requestWillBeSent', {requestId: '1', wallTime: 1, timestamp: 10, request: {url, method: 'GET'}});
  ledger.event('s', false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 80, timing: {requestTime: 10.15}}});
  ledger.event('s', false, 'Network.dataReceived', {requestId: '1', dataLength: 4, encodedDataLength: 4});
  ledger.event('s', false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 84});
  expect(ledger.read(request(url, 1150))).toMatchObject({decodedBytes: 4, encodedBytes: 4, transferBytes: 84});
});
test('304 wire bytes are headers, independently from the cached response body', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/revalidated'; begin(ledger, url);
  ledger.event('session', false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 0, fromDiskCache: true}});
  ledger.event('session', false, 'Network.responseReceivedExtraInfo', {requestId: '1', statusCode: 304});
  ledger.event('session', false, 'Network.dataReceived', {requestId: '1', dataLength: 4600, encodedDataLength: 0});
  ledger.event('session', false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 164});
  expect(ledger.read(request(url))).toMatchObject({decodedBytes: 4600, encodedBytes: 0, transferBytes: 164});
});
test('a migrated worker request keeps one identity and duplicate native data events count once', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/worker'; begin(ledger, url);
  ledger.event('child', false, 'Network.requestWillBeSent', {requestId: '1', wallTime: 1, request: {url, method: 'GET'}});
  for (const session of ['session', 'child']) {
    ledger.event(session, false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 80}});
    ledger.event(session, false, 'Network.dataReceived', {requestId: '1', timestamp: 2, dataLength: 4, encodedDataLength: 4});
    ledger.event(session, false, 'Network.loadingFinished', {requestId: '1', encodedDataLength: 84});
  }
  expect(ledger.read(request(url))).toMatchObject({decodedBytes: 4, encodedBytes: 4, transferBytes: 84});
});
test('aborted streams retain observed bytes and a partial flag, never a fictitious complete body', () => {
  const ledger = new NativeSizeLedger(), url = 'https://game.test/aborted'; begin(ledger, url);
  ledger.event('session', false, 'Network.responseReceived', {requestId: '1', response: {encodedDataLength: 80}});
  ledger.event('session', false, 'Network.dataReceived', {requestId: '1', dataLength: 12, encodedDataLength: 4});
  ledger.event('session', false, 'Network.loadingFailed', {requestId: '1', canceled: true, errorText: 'net::ERR_ABORTED'});
  expect(ledger.read(request(url))).toMatchObject({decodedBytes: 12, encodedBytes: 4, transferBytes: 84, partial: true});
});
