// SF22d (E435): one parity capture (scripts/parity.mjs capture) with Debug ▸ Memory saver ON, logging saver warnings, NaN errors and
// every new GPU readback stack (getBufferSubData on COPY_READ_BUFFER), plus the poses' draw calls and triangles.
// scripts/browser-lane.sh --max 15 node progress/shard-platform/SF22d-capture-probe.mjs <url> pine-hollow desktop <out dir>
import { chromium } from 'playwright';
import { capture } from '../../scripts/parity.mjs';
import { mkdirSync } from 'node:fs';
const [url, shard, tier, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const real = await chromium.launch({ channel: 'chromium', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const logs = []; const pages = [];
const browser = new Proxy(real, { get(t, k) {
  if (k === 'newContext') return async (...a) => { const c = await t.newContext(...a); await c.addInitScript(() => { const rb = { calls: 0, bytes: 0, stacks: {} }; window.__rb = rb; const g = WebGL2RenderingContext.prototype.getBufferSubData; WebGL2RenderingContext.prototype.getBufferSubData = function (...x) { if (x[0] === 0x8F36) { rb.calls++; rb.bytes += x[2]?.byteLength ?? 0; const k = new Error().stack.split('\n').slice(3, 9).map((l) => l.trim().replace(/https?:[^ )]*\/assets\//u, '')).join(' < '); if (rb.stacks[k] === undefined) console.log('RBNEW ' + (x[2]?.byteLength ?? 0) + ' ' + k); rb.stacks[k] = (rb.stacks[k] ?? 0) + 1; if (rb.calls % 50 === 0) console.log('RBCOUNT ' + rb.calls + ' ' + rb.bytes); } return g.apply(this, x); }; }); c.on('page', (p) => { pages.push(p); }); c.on('page', (p) => p.on('console', (m) => { const s = m.text(); if (/memory saver|NaN|^RB/u.test(s)) logs.push(m.type() + ': ' + s.slice(0, 300)); })); return c; };
  const v = Reflect.get(t, k); return typeof v === 'function' ? v.bind(t) : v; } });
try {
  const rec = await capture(browser, url, { shard, tier, lane: 'm5', sha: 'probe', root: new URL('../..', import.meta.url).pathname, out, timeout: 240, full: false, only: undefined, offline: false, accelerated: true, settings: { memorySaver: 'on' } });
  for (const p of pages) { try { if (!p.isClosed()) logs.push('RB ' + JSON.stringify(await p.evaluate(() => window.__rb))); } catch { /* closed */ } }
  console.log(JSON.stringify({ logs: [...new Set(logs)], poses: (rec.poses ?? []).map((p) => ({ name: p.name, calls: p.calls, tris: p.tris })) }, null, 1));
} finally { await real.close(); }
