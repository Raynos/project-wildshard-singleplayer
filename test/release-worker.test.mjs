import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import { observeReleaseModules, waitForReleaseWorker } from '../scripts/release-worker.mjs';
const page = ready => ({ evaluate: (fn, timeout) => runInNewContext(`(${fn.toString()})(timeout)`, { navigator: { serviceWorker: { ready } }, timeout, setTimeout, clearTimeout, Error }) });
class Worker extends EventTarget {
  state = 'activating';
  change(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
test('release waits for both registration readiness and actual activation', async () => {
  let ready;
  const registration = new Promise(resolve => { ready = resolve; });
  const worker = new Worker();
  let finished = false;
  const result = waitForReleaseWorker(page(registration), 1000).then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  ready({ active: worker });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(finished, false, 'an activating worker cannot admit the reload');
  worker.change('activated'); await result;
  assert.equal(finished, true);
});
test('already activated workers pass; missing or redundant workers refuse', async () => {
  const worker = new Worker(); worker.change('activated');
  await waitForReleaseWorker(page(Promise.resolve({ active: worker })), 1000);
  await assert.rejects(waitForReleaseWorker(page(Promise.resolve({ active: null })), 1000), /no active registration/u);
  worker.change('redundant');
  await assert.rejects(waitForReleaseWorker(page(Promise.resolve({ active: worker })), 1000), /became redundant/u);
  await assert.rejects(waitForReleaseWorker(page(Promise.reject(undefined)), 1000), /readiness rejected/u);
});
test('blocked registration has a deadline and cannot admit a late activation', async () => {
  let ready;
  const registration = new Promise(resolve => { ready = resolve; });
  let completed = false;
  await assert.rejects(waitForReleaseWorker(page(registration), 10).then(() => { completed = true; }), /timed out/u);
  const worker = new Worker(); ready({ active: worker }); worker.change('activated');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(completed, false);
});
test('reload waits for real module completion and newly started dependencies', async () => {
  const page = new EventEmitter(), observer = observeReleaseModules(page);
  const first = { resourceType: () => 'script', url: () => 'https://example.test/b/one.js' };
  const next = { resourceType: () => 'other', url: () => 'https://example.test/b/two.js' };
  page.emit('request', first);
  let finished = false;
  const waiting = observer.wait(1000, 1).then(() => { finished = true; });
  page.emit('requestfinished', first); page.emit('request', next);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(finished, false, 'the next module must finish before navigation');
  page.emit('requestfinished', next); await waiting;
  assert.equal(finished, true); observer.dispose();
});
test('unsettled modules refuse; failed transfers settle without hiding page errors', async () => {
  const page = new EventEmitter(), observer = observeReleaseModules(page);
  const request = { resourceType: () => 'script', url: () => 'https://example.test/b/one.js' };
  page.emit('request', request);
  await assert.rejects(observer.wait(10, 1), /did not settle/u);
  let errors = 0; page.on('pageerror', () => { errors += 1; });
  page.emit('pageerror', new Error('real import failure')); page.emit('requestfailed', request);
  await observer.wait(1000, 1); assert.equal(errors, 1); observer.dispose();
});
