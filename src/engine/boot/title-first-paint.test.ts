// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual first document before application bundles.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { afterEach, expect, test } from 'vitest';
import { showStartTitle } from '../ui/StartTitle';
import type { TitleDeckView } from '../ui/HUD';

const html = readFileSync('index.html', 'utf8');
const windows: Window[] = [];
interface Frames { now: number; callbacks: FrameRequestCallback[] }
afterEach(async () => {
  for (const window of windows.splice(0)) await window.happyDOM.close();
  document.body.innerHTML = '';
});
function firstDocument(search: string, frames?: Frames): Window {
  const window = new Window({ url: `https://launch.test/${search}`, width: 402, height: 874, settings: {
    enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    enableImageFileLoading: false, handleDisabledFileLoadingAsSuccess: true,
  } });
  if (frames !== undefined) {
    Object.defineProperty(window.performance, 'now', { value: () => frames.now });
    const nativeFrame = window.requestAnimationFrame.bind(window);
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- RAF returns happy-dom's native handle; this fixture owns callback delivery.
    window.requestAnimationFrame = callback => { frames.callbacks.push(callback); return nativeFrame(() => undefined); };
  }
  windows.push(window);
  window.document.write(html);
  return window;
}

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

test('a title handoff restarts the inline clock without application modules', async () => {
  const window = firstDocument(''), root = window.document.querySelector('.ws-load[data-shell]');
  if (!(root instanceof window.HTMLElement)) throw new Error('Missing inline shell');
  const name = root.querySelector('[data-el="slug"]'); if (name === null) throw new Error('Missing destination');
  name.textContent = 'A different island'; root.dataset['navigation'] = '';
  window.document.documentElement.classList.remove('title-first');
  window.document.dispatchEvent(new window.Event('ws:loading-navigation'));
  expect(root.dataset['step']).toBe('navigation.document');
  expect(name.textContent).toBe('A different island');
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
  root.dataset['codePackUrl'] = '/application.pack'; root.dataset['codePackLoaded'] = '1048576'; root.dataset['codePackTotal'] = '2097152';
  frame(8500); expect(wait.hidden).toBe(true);
  expect(root.querySelector('[data-el="dlFact"]')?.textContent).toBe('1.00 / 2.00 MB application code');
  expect(root.dataset['moduleBytes']).toBe('0'); // Progress visibility never credits a verified receipt.
  frame(16499); expect(wait.hidden).toBe(true);
  frame(16500); expect(wait.hidden).toBe(false); // Duplicate messages never renew the deadline.
  root.dataset['codePackLoaded'] = '2097152'; frame(16600); expect(wait.hidden).toBe(true);
  root.dataset['codePackUrl'] = '/next.pack'; root.dataset['codePackLoaded'] = '0'; frame(17000);
  root.dataset['codePackLoaded'] = '1048576'; frame(24000); expect(wait.hidden).toBe(true);
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
