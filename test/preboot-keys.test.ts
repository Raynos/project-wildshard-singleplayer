// @vitest-environment happy-dom
import html from '../index.html?raw';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual preboot inline scripts in an isolated Node VM for this test.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)].map((m) => m[1] ?? '');
function run(device: string, session: string): void {
  delete document.documentElement.dataset['dev'];
  document.body.innerHTML = '<div class="ws-load"></div><div class="ws-resume"><div class="ws-resume-shot"></div><div class="ws-resume-hero"></div><div class="ws-resume-shard"></div><div class="ws-resume-bar"></div></div>';
  const context = { document, navigator: {}, matchMedia: () => ({ matches: false }), URLSearchParams, location: { search: '?glreload' }, localStorage: { getItem: () => device }, sessionStorage: { getItem: () => session } };
  for (const script of scripts.filter((s) => s.includes('wildshard.save.v2.'))) runInNewContext(script, context);
}
it('reads developer mode and the per-tab resume frame before the bundle', () => {
  run('{"keys":{"devMode":{"v":1,"data":true}}}', '{"keys":{"resume.shot":{"v":1,"data":"frame.jpg"},"resume.brand":{"v":1,"data":{"name":"Pine Hollow","hero":"pine.jpg"}}}}');
  expect(document.documentElement.dataset['dev'] !== undefined).toBe(true);
  expect(document.querySelector('.ws-resume-shot')?.getAttribute('style')).toContain('frame.jpg');
  expect(document.querySelector('.ws-resume-shard')?.textContent).toBe('Pine Hollow');
});
it('treats malformed preboot documents as absent without throwing', () => {
  expect(() => { run('garbage', 'garbage'); }).not.toThrow();
  expect(document.documentElement.dataset['dev'] !== undefined).toBe(false);
  expect(document.querySelector('.ws-resume')?.classList.contains('show')).toBe(false);
});
