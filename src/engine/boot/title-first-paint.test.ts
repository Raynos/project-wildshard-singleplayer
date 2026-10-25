// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual first document before application bundles.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { afterEach, expect, test } from 'vitest';
import { showStartTitle } from '../ui/StartTitle';
import type { TitleDeckView } from '../ui/HUD';

const html = readFileSync('index.html', 'utf8');
const windows: Window[] = [];
afterEach(async () => {
  for (const window of windows.splice(0)) await window.happyDOM.close();
  document.body.innerHTML = '';
});
function firstDocument(search: string): Window {
  const window = new Window({ url: `https://launch.test/${search}`, width: 402, height: 874, settings: {
    enableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
    enableImageFileLoading: false, handleDisabledFileLoadingAsSuccess: true,
  } });
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
