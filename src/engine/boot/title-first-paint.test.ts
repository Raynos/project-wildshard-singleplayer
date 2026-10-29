// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual first document before application bundles.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { afterEach, expect, test, vi } from 'vitest';
import { showStartTitle } from '../ui/StartTitle';
import type { TitleDeckView } from '../ui/HUD';
import { loadingWaitState, type LoadingWaitEntry } from './download';

const html = readFileSync('index.html', 'utf8');
const windows: Window[] = [];
interface Frames { now: number; callbacks: FrameRequestCallback[] }
afterEach(async () => {
  vi.restoreAllMocks();
  for (const window of windows.splice(0)) await window.happyDOM.close();
  document.body.innerHTML = '';
});
function firstDocument(search: string, frames?: Frames, developer = false, handoffMs = 0): Window {
  const window = new Window({ url: `https://launch.test/${search}`, width: 402, height: 874, settings: {
    enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    enableImageFileLoading: false, handleDisabledFileLoadingAsSuccess: true,
  } });
  if (frames !== undefined) {
    vi.spyOn(window.performance, 'now').mockImplementation(() => frames.now);
    const nativeFrame = window.requestAnimationFrame.bind(window);
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- RAF returns happy-dom's native handle; this fixture owns callback delivery.
    window.requestAnimationFrame = callback => { frames.callbacks.push(callback); return nativeFrame(() => undefined); };
  }
  windows.push(window);
  if (handoffMs > 0) window.sessionStorage.setItem('wildshard.save.v2.session', JSON.stringify({keys: {titleArrival: {data: JSON.stringify({
    slug: 'driftwood-isle', name: 'Home', mode: 'enter', at: window.performance.timeOrigin + (frames?.now ?? 0) - handoffMs,
  })}}}));
  window.document.write(html);
  // Happy DOM does not retain the head's lexical homeParams across script tags;
  // the real storage-to-Developer gate is covered by the two-engine phone run.
  if (developer) window.document.documentElement.dataset['dev'] = '';
  return window;
}

test('a fresh document clock retains the real handoff elapsed time without moving its wait deadline', () => {
  const frames: Frames = {now: 0, callbacks: []}, window = firstDocument('?chunk=driftwood-isle', frames, false, 1700);
  const root = window.document.querySelector('.ws-load');
  if (!(root instanceof window.HTMLElement)) throw new Error('Missing inline loading panel');
  expect(root.querySelector('[data-el="clock"]')?.textContent).toBe('00:01.7');
  expect(Number(root.dataset['startedAt'])).toBe(0);
  expect(Number(root.dataset['clockStartedAt'])).toBeCloseTo(-1700, 0);
  const waits = loadingWaitState(window.document);
  expect([...waits.pending.values()][0]).toMatchObject({startedAt: 0, progressAt: 0, deadlineMs: 8000});
  frames.now = 250; for (const render of frames.callbacks.splice(0)) render(frames.now);
  expect(root.querySelector('[data-el="clock"]')?.textContent).toBe('00:01.9');
});

test('plain launch paints the approved hero and an indeterminate boat without application modules', () => {
  const window = firstDocument(''), panel = window.document.querySelector('[data-title-shell]');
  if (panel === null) throw new Error('Missing inline title');
  expect(window.document.documentElement.classList.contains('title-first')).toBe(true);
  expect(window.getComputedStyle(panel).display).toBe('flex');
  expect(window.getComputedStyle(panel).position).toBe('fixed');
  const hero = panel.querySelector('.ws-launch-hero'), boat = panel.querySelector('.ws-launch-boat');
  if (hero === null || boat === null) throw new Error('Missing title art/progress');
  expect(window.getComputedStyle(hero).backgroundImage).toContain('main-crossroads-square.jpg');
  expect(window.getComputedStyle(boat).animation).toContain('ws-launch-sail');
  expect(panel.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false);
  expect(window.document.querySelector('link[as="image"]')?.getAttribute('href')).toBe('/assets/title/main-crossroads-square.jpg');
  expect(window.document.querySelector('#hud')?.childElementCount).toBe(0);
});

test('a selected shard keeps its existing loader and does not preload the title hero', () => {
  const window = firstDocument('?chunk=driftwood-isle'), panel = window.document.querySelector('[data-title-shell]');
  if (panel === null) throw new Error('Missing title shell');
  expect(window.document.documentElement.classList.contains('title-first')).toBe(false);
  expect(window.getComputedStyle(panel).display).toBe('none');
  expect(window.document.querySelector('link[as="image"]')).toBeNull();
  expect(window.document.querySelector('.ws-load[data-shell]')).not.toBeNull();
  const root = window.document.querySelector('.ws-load[data-shell]');
  if (!(root instanceof window.HTMLElement)) throw new Error('Missing loading shell');
  expect(root.dataset['initialSetup']).toBe(root.querySelector('[data-el="suPct"]')?.textContent);
  expect(root.dataset['initialSetup']).toBe('0');
  expect(Number.isFinite(Number(root.dataset['startedAt']))).toBe(true);
  expect(window.getComputedStyle(root).position).toBe('fixed');
  expect(window.getComputedStyle(root).display).toBe('flex');
  expect([...html.matchAll(/<link rel="stylesheet"[^>]*>/gu)].every(([link]) => link.includes('media="print"') && link.includes('onload='))).toBe(true);
});

test('public first paint and admitted loading keep every detailed progress field visible', () => {
  const window = firstDocument('?chunk=driftwood-isle'), root = window.document.querySelector('.ws-load[data-shell]');
  if (!(root instanceof window.HTMLElement)) throw new Error('Missing public loading shell');
  const detailed = ['.ws-load-clock', '.ws-load-meta', '.ws-load-track', '.ws-load-log', '.ws-load-diagnostics', '.ws-load-foot'];
  const visible = (): void => {
    expect(Object.hasOwn(window.document.documentElement.dataset, 'dev')).toBe(false);
    for (const selector of detailed) {
      const field = root.querySelector(selector);
      if (!(field instanceof window.HTMLElement)) throw new Error(`Missing progress field ${selector}`);
      expect(window.getComputedStyle(field).display).not.toBe('none');
    }
  };
  visible();
  const style = window.document.createElement('style');
  style.textContent = readFileSync('src/engine/ui/loading.css', 'utf8'); window.document.head.append(style);
  delete root.dataset['shell']; visible();
  const simple = root.querySelector('.ws-load-simple');
  if (!(simple instanceof window.HTMLElement)) throw new Error('Missing compatibility progress field');
  expect(window.getComputedStyle(simple).display).toBe('none');
});

test('a title handoff restarts the inline clock without application modules', async () => {
  const window = firstDocument('', undefined, true), root = window.document.querySelector('.ws-load[data-shell]');
  if (!(root instanceof window.HTMLElement)) throw new Error('Missing inline shell');
  const name = root.querySelector('[data-el="slug"]'); if (name === null) throw new Error('Missing destination');
  const state = loadingWaitState(window.document);
  const old: LoadingWaitEntry = { id: ++state.sequence, label: 'Old title background read', kind: 'file', step: null, owner: null,
    startedAt: -1, progressAt: -1, loadedBytes: 0, totalBytes: null, deadlineMs: 8000, retry: null, progress: '', inline: false };
  state.pending.set(old.id, old);
  name.textContent = 'A different island'; root.dataset['navigation'] = '';
  window.document.documentElement.classList.remove('title-first');
  window.document.dispatchEvent(new window.Event('ws:loading-navigation'));
  expect(root.dataset['step']).toBe('navigation.document');
  expect(name.textContent).toBe('A different island');
  expect(root.querySelector('[data-el="line"]')?.textContent).toBe('Opening A different island');
  const clock = root.querySelector('[data-el="clock"]');
  if (!(clock instanceof window.HTMLElement)) throw new Error('Missing clock');
  expect(window.getComputedStyle(clock).display).not.toBe('none');
  await new Promise(resolve => { setTimeout(resolve, 180); });
  expect(root.querySelector('[data-el="clock"]')?.textContent).not.toBe('00:00.0');
});

test('the inline eight-second retry uses real byte progress, including per-pack progress before modules', () => {
  const frames: Frames = { now: 0, callbacks: [] }, window = firstDocument('', frames);
  const root = window.document.querySelector('.ws-load[data-shell]'), wait = window.document.querySelector('.ws-launch-wait');
  if (!(root instanceof window.HTMLElement) || !(wait instanceof window.HTMLElement)) throw new Error('Missing inline loading UI');
  const frame = (at: number): void => { frames.now = at; for (const run of frames.callbacks.splice(0)) run(at); };
  frame(7999); expect(wait.hidden).toBe(true);
  frame(8000); expect(wait.hidden).toBe(false); expect(wait.textContent).toContain('Waiting for Application modules · 8.0 s');
  const state = loadingWaitState(window.document);
  const pack: LoadingWaitEntry = { id: ++state.sequence, label: 'Application code /application.pack', kind: 'file', step: null, owner: null,
    startedAt: 8500, progressAt: 8500, loadedBytes: 1048576, totalBytes: 2097152, deadlineMs: 8000,
    retry: null, progress: '', inline: false };
  state.pending.set(pack.id, pack); frame(8500); expect(wait.hidden).toBe(true);
  expect(root.querySelector('[data-el="dlFact"]')?.textContent).toBe('1.00 / 2.00 MB · Application code /application.pack');
  expect(root.dataset['moduleBytes']).toBe('0'); // Visibility never credits a verified receipt.
  frame(16499); expect(wait.hidden).toBe(true);
  frame(16500); expect(wait.hidden).toBe(false); // Duplicate messages never renew the deadline.
  pack.loadedBytes = 2097152; pack.progressAt = 16600; frame(16600); expect(wait.hidden).toBe(true);
  pack.loadedBytes = 0; pack.totalBytes = 2097152; pack.label = 'Application code /next.pack'; pack.progressAt = 17000; frame(17000);
  pack.loadedBytes = 1048576; pack.progressAt = 24000; frame(24000); expect(wait.hidden).toBe(true);
  pack.label = 'Stylesheet /held.css'; frame(32000);
  expect(wait.textContent).toContain('Waiting for Stylesheet /held.css · 8.0 s');
});

test('the first-paint panel survives failed title start and retires only after the real deck is mounted', () => {
  document.body.innerHTML = '<div data-title-shell></div><div id="hud"></div>';
  const shell = document.querySelector('[data-title-shell]');
  const build = (refuse: boolean): TitleDeckView => {
    const root = document.createElement('div');
    return { root, cards: [], index: 0, select: () => undefined, activate: () => undefined, dispose: () => root.remove(),
      start: () => {
        expect(root.isConnected).toBe(true); expect(shell?.isConnected).toBe(true);
        if (refuse) throw new Error('Title refused');
      },
    };
  };
  expect(() => showStartTitle(() => build(true))).toThrow('Title refused');
  expect(shell?.isConnected).toBe(true);
  showStartTitle(() => build(false));
  expect(shell?.isConnected).toBe(false);
});


test('the standalone launch image matches the declared phone pixel dimensions', () => {
  const window = firstDocument('');
  const link = window.document.querySelector('link[rel="apple-touch-startup-image"]');
  expect(link?.getAttribute('media')).toContain('(device-width: 402px)');
  expect(link?.getAttribute('media')).toContain('(device-height: 874px)');
  expect(link?.getAttribute('media')).toContain('(-webkit-device-pixel-ratio: 3)');
  const href = link?.getAttribute('href');
  if (href === undefined || href === null) throw new Error('Missing native launch image');
  expect(href).toMatch(/^\/assets\/title\/launch-1206x2622-[a-f0-9]{12}\.png$/u);
  const png = readFileSync(`public${href}`);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1206, 2622]);
});
