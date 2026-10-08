// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Executes the actual inline shell while application modules remain blocked.
import { runInNewContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import html from '../index.html?raw';
import { loadShellHtml } from '../src/engine/boot/shell';
import { setTitleArrival, consumeTitleArrival } from '../src/engine/boot/titleArrival';
import { beginLoading } from '../src/engine/ui/Loading';
import { app } from '../src/engine/app/runtime';
import { Scope } from '../src/engine/app/scope';
import type { ProgressView } from '../src/engine/boot/plan';

const script = /<script data-loading-first-paint>([\s\S]*?)<\/script>/u.exec(html)?.[1];
if (script === undefined) throw new Error('Missing first-paint script');
afterEach(() => { document.body.replaceChildren(); document.documentElement.classList.remove('title-first'); app.levelScope = null; vi.useRealTimers(); });

it('names the shard, shows the provisional tier and counts module bytes while application imports are still blocked; handoff stops the shell clock', () => {
  vi.useFakeTimers();
  vi.stubGlobal('sessionStorage', window.sessionStorage);
  setTitleArrival({ slug: 'first-paint', mode: 'enter', name: 'Selected <shard>' });
  document.body.innerHTML = `<div class="ws-load" data-shell>${loadShellHtml()}</div>`;
  const frames: (() => void)[] = []; let now = 10;
  const resources = [{ name: '/app.js', startTime: 0, initiatorType: 'script', encodedBodySize: 2048, transferSize: 2300 }];
  runInNewContext(script, { document, navigator: { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 }, location: new URL('https://test.invalid/?chunk=first-paint'), URLSearchParams, Date,
    localStorage, sessionStorage, performance: { now: () => now, getEntriesByType: () => resources }, requestAnimationFrame: (fn: () => void) => frames.push(fn) });
  const root = document.querySelector<HTMLElement>('.ws-load'); if (root === null) throw new Error('Missing shell');
  expect(root.querySelector('[data-el="slug"]')?.textContent).toBe('Selected <shard>');
  expect(root.querySelector('[data-el="tier"]')?.textContent).toContain('phone');
  expect(root.querySelector('[data-el="dlFact"]')?.textContent).toContain('modules read');
  now += 1200; frames.shift()?.();
  expect(root.querySelector('[data-el="clock"]')?.textContent).toBe('00:01.2');
  expect(root.dataset['moduleBytes']).toBe('2048');
  expect(consumeTitleArrival('first-paint')).toEqual({ slug: 'first-paint', mode: 'enter' });
  delete root.dataset['shell']; frames.shift()?.(); expect(frames).toHaveLength(0);
});

it('adopts the same panel through admission and ordinary setup, keeps verified bytes after module waits, and only reaches 100 when the plan does', () => {
  vi.useFakeTimers();
  const scope = new Scope('loading-admission'); app.levelScope = scope;
  const loading = beginLoading({ id: 'progress-fixture', name: 'Progress fixture' });
  loading.paintAdmission({ phase: 'descriptor', detail: 'Reading descriptor', bytesRead: 100, bytesTotal: 100, filesDone: 1, filesTotal: 1 });
  loading.paintAdmission({ phase: 'complete', detail: 'Product admitted', bytesRead: 900, bytesTotal: 900, filesDone: 2, filesTotal: 2 });
  loading.waiting('Preparing audio catalogue');
  expect(beginLoading({ id: 'progress-fixture', name: 'Progress fixture' })).toBe(loading);
  const view: ProgressView = { setup: 0.5, download: 0.5, worldBytesReady: true, done: false, error: null, step: 'audio', label: 'Audio', detail: '', bytes: null, bytesRead: 50, bytesTotal: 100, filesDone: 0, filesTotal: 1, doneCount: 0, rows: [] };
  loading.paint(view);
  vi.advanceTimersByTime(35);
  expect(loading.root.querySelector('[data-el="line"]')?.textContent).toContain('Building the world');
  expect(loading.root.dataset['download']).toBe('95');
  loading.paint({ ...view, setup: 1, download: 1, worldBytesReady: true, done: true, bytesRead: 100, filesDone: 1 });
  expect(loading.root.dataset['download']).toBe('100'); expect(loading.root.dataset['setup']).toBe('100');
  scope.dispose();
});

it('keeps ordinary non-product boot completion at 100 after a module-only wait', () => {
  vi.useFakeTimers(); const scope = new Scope('loading-legacy'); app.levelScope = scope;
  const loading = beginLoading({ id: 'legacy-fixture', name: 'Legacy fixture' }); loading.waiting('Loading application modules');
  loading.paint({ setup: 1, download: 1, worldBytesReady: true, done: true, error: null, step: 'audio', label: 'Audio', detail: '', bytes: null, bytesRead: 0, bytesTotal: 0, filesDone: 0, filesTotal: 0, doneCount: 0, rows: [] });
  expect(loading.root.dataset['setup']).toBe('100'); scope.dispose();
});
