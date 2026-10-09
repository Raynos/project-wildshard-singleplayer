// SF57 leak5: symbolize the upload sites a DIAG drive recorded (minified production frames → source file:line via the
// build's source maps), then group the unowned uploads by type and site, with the growth between two heap poses.
//   node symbolize.mjs <dist dir> <result.json> [cycleA cycleB] [frames]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.pnpm/node_modules/');
const { SourceMapConsumer } = require('source-map-js');
const [dist, file, a0, b0, f0] = process.argv.slice(2);
const r = JSON.parse(readFileSync(file, 'utf8'));
const maps = new Map();
const consumer = (asset) => {
  if (!maps.has(asset)) {
    const p = join(dist, 'assets', `${asset}.map`);
    maps.set(asset, existsSync(p) ? new SourceMapConsumer(JSON.parse(readFileSync(p, 'utf8'))) : null);
  }
  return maps.get(asset);
};
const SKIP = /uploadOwnership|node_modules\/three|memorySaver|postprocessing|sceneOwnership|compressedUpload|gpuLabels|frameCounter/;
const frame = (raw) => {
  const m = /\/assets\/([^/:]+\.js):(\d+):(\d+)/.exec(raw);
  if (!m) return null;
  const c = consumer(m[1]);
  if (!c) return null;
  const pos = c.originalPositionFor({ line: Number(m[2]), column: Number(m[3]) - 1 });
  if (!pos.source) return null;
  const src = pos.source.replace(/^.*?(src\/|node_modules\/)/, '$1');
  return { src, text: `${src.replace(/^src\//, '')}:${pos.line}${pos.name ? ` ${pos.name}` : ''}` };
};
const nFrames = Number(f0 ?? 4);
const site = (s) => {
  if (!s) return '- (held: acquired / cached)';
  const [stack, obj] = s.split(' || obj ');
  s = stack;
  const out = [];
  let threeTop = null;
  for (const raw of s.split(' | ')) {
    const f = frame(raw); if (!f) continue;
    if (SKIP.test(f.src)) { if (threeTop === null && /three|postprocessing/.test(f.src)) threeTop = f.text.split('/').pop(); continue; }
    out.push(f.text); if (out.length >= nFrames) break;
  }
  return `${threeTop ?? ''} :: ${out.join(' < ')}${obj ? ` :: obj ${obj.split(' < ').slice(0, 4).join(' < ')}` : ''}`;
};
const kind = (u) => u.kind ?? u.type;
const groups = (h) => {
  const c = new Map();
  for (const u of h.gpu.unowned) { const k = `${kind(u)} | ${u.name ?? ''} | owner ${u.owner} | ${site(u.site)}`; c.set(k, (c.get(k) ?? 0) + 1); }
  return c;
};
const heap = r.heap;
for (const h of heap) console.log(`c${h.cycle}: heap ${h.usedMB.toFixed(1)} MB gl ${JSON.stringify(h.gpu.memory)} live ${h.gpu.live} unowned ${h.gpu.unowned.length} orphans ${JSON.stringify(h.gpu.orphans)} stray ${h.owners?.strayReads}`);
const A = a0 !== undefined ? Number(a0) : heap.at(-2)?.cycle, B = b0 !== undefined ? Number(b0) : heap.at(-1)?.cycle;
const ha = heap.find((h) => h.cycle === A), hb = heap.find((h) => h.cycle === B);
if (ha && hb) {
  const ga = groups(ha), gb = groups(hb);
  console.log(`\nunowned growth c${A} -> c${B}:`);
  const keys = [...new Set([...ga.keys(), ...gb.keys()])].map((k) => [k, (gb.get(k) ?? 0) - (ga.get(k) ?? 0)]).filter(([, d]) => d !== 0).sort((x, y) => y[1] - x[1]);
  for (const [k, d] of keys) console.log(`  ${d > 0 ? '+' : ''}${d} (${gb.get(k) ?? 0})  ${k}`);
}
if (hb) {
  console.log(`\nunowned at c${B}, top:`);
  for (const [k, n] of [...groups(hb).entries()].sort((x, y) => y[1] - x[1]).slice(0, 40)) console.log(`  ${n}  ${k}`);
}
