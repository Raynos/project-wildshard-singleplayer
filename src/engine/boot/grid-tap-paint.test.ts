// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Assert actual first-document CSS/module order.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Scope } from '../app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../app/scopeEnvironment';
import { loadShellTemplate, beginNavigationShell } from './shell';

const native = scopeEnvironment();
let owner = new Scope('tap-test'), next = 1;
const queued = new Map<number, (time: number) => void>();
beforeEach(() => {
  owner = new Scope('tap-test'); queued.clear();
  installScopeEnvironment({ ...native, frame: render => { const id = next++; queued.set(id, render); return id; }, cancelFrame: id => { queued.delete(id); } });
  document.documentElement.className = 'title-first'; document.body.innerHTML = '<button class="ws-main-grid">Enter world</button>';
  document.head.innerHTML = `<style>html.title-first .ws-load{display:none}${readFileSync('src/engine/ui/loading.css', 'utf8')}</style>`;
});
afterEach(() => { owner.dispose(); installScopeEnvironment(native); document.head.innerHTML = ''; document.body.innerHTML = ''; document.documentElement.className = ''; });
function frame(time: number): void { const due = [...queued.values()]; queued.clear(); for (const render of due) render(time); }
function card(): HTMLButtonElement { const button = document.querySelector<HTMLButtonElement>('.ws-main-grid'); if (button === null) throw new Error('No title card'); return button; }

test('the loader stylesheet is available before any application module executes', () => {
  const html = readFileSync('index.html', 'utf8'), sheet = html.indexOf('href="/src/engine/ui/loading.css"');
  expect(sheet).toBeGreaterThan(0); expect(sheet).toBeLessThan(html.indexOf('<script type="module"'));
  expect(html).toContain('class="ws-load" data-shell');
});

test('a tap displays the real shell, paints a 30 Hz frame, then hands off exactly once', () => {
  document.body.insertAdjacentHTML('beforeend', `<div class="ws-load hide" data-shell>${loadShellTemplate()}</div>`);
  const navigate = vi.fn<() => void>(), button = card();
  owner.listen(button, 'click', () => { beginNavigationShell('The Home Island', owner, navigate, button); });
  button.click(); button.click();
  const shell = document.querySelector('.ws-load'); if (shell === null) throw new Error('Tap removed its shell');
  expect(document.querySelectorAll('.ws-load')).toHaveLength(1); expect(getComputedStyle(shell).display).toBe('flex');
  expect(shell.querySelector('[data-el="slug"]')?.textContent).toBe('The Home Island');
  expect(button.disabled).toBe(true); expect(button.getAttribute('aria-busy')).toBe('true');
  expect(navigate).not.toHaveBeenCalled(); expect(queued.size).toBe(1);
  frame(1000 / 30); expect(navigate).not.toHaveBeenCalled(); expect(getComputedStyle(shell).display).toBe('flex');
  frame(2000 / 30); expect(navigate).toHaveBeenCalledTimes(1); expect(queued.size).toBe(0);
});

test('a running page creates the identical retired shell and a handoff failure restores its title/card', () => {
  beginNavigationShell('Home', owner, () => { throw new Error('Navigation refused'); }, card());
  const expected = document.createElement('div'); expected.innerHTML = loadShellTemplate();
  const destination = expected.querySelector('[data-el="slug"]'); if (destination === null) throw new Error('Template lost its destination');
  destination.textContent = 'Home'; expect(document.querySelector('.ws-load')?.innerHTML).toBe(expected.innerHTML);
  frame(16); expect(() => frame(32)).toThrow('Navigation refused');
  expect(document.querySelector('.ws-load')).toBeNull(); expect(document.documentElement.classList.contains('title-first')).toBe(true);
  expect(card().disabled).toBe(false); expect(card().hasAttribute('aria-busy')).toBe(false);
});

test('failure restores an adopted panel and a later user tap may start a new attempt', () => {
  const root = document.createElement('div'); root.className = 'ws-load hide'; root.innerHTML = loadShellTemplate(); document.body.append(root);
  const attempt = beginNavigationShell('Home', owner, () => { throw new Error('Navigation refused'); }, card());
  frame(16); expect(() => frame(32)).toThrow('Navigation refused'); expect(attempt.disposed).toBe(true);
  expect(root.className).toBe('ws-load hide'); expect(Object.hasOwn(root.dataset, 'navigation')).toBe(false);
  expect(root.querySelector('[data-el="slug"]')?.textContent).toBe('');
  const navigate = vi.fn<() => void>(); beginNavigationShell('Home', owner, navigate, card());
  frame(48); frame(64); expect(navigate).toHaveBeenCalledTimes(1);
});

test('ancestor retirement cancels the handoff between its two frames', () => {
  const navigate = vi.fn<() => void>(), child = owner.child('title');
  beginNavigationShell('Home', child, navigate, card()); frame(16); owner.dispose(); frame(32);
  expect(navigate).not.toHaveBeenCalled(); expect(queued.size).toBe(0); expect(document.querySelector('.ws-load')).toBeNull();
});

test('the lightweight shell retires without touching a running canvas or HUD', () => {
  document.documentElement.className = ''; const canvas = document.createElement('canvas'), hud = document.createElement('div');
  canvas.id = 'game'; hud.id = 'hud'; document.body.append(canvas, hud);
  beginNavigationShell('A different home', owner, () => undefined);
  expect(canvas.isConnected && hud.isConnected).toBe(true); expect(owner.census.nodes).toBe(1); owner.dispose();
  expect(document.documentElement.classList.contains('title-first')).toBe(false);
  expect(canvas.isConnected && hud.isConnected).toBe(true); expect(document.querySelector('.ws-load')).toBeNull();
});

test('a retired owner refuses before creating a loader or scheduling work', () => {
  owner.dispose(); const navigate = vi.fn<() => void>();
  expect(() => beginNavigationShell('Home', owner, navigate, card())).toThrow('live owner');
  expect(document.querySelector('.ws-load')).toBeNull(); expect(queued.size).toBe(0); expect(navigate).not.toHaveBeenCalled();
});
