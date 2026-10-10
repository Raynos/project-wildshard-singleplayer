#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's zipline landing and creek footbridge built
// offline. The generator (src/shards/pine-hollow/generators/siteTimbers.ts) runs here only, with the Pine level selected
// and its baked terrain grid installed (the page's heights: both are fitted to the ground under them; the grid carries
// the level seed, which is the timbers' stream), and writes what each builder leaves, at its site and on the turntable
// (each material's parts and the glass as float32 blocks, in byte lanes, zlib) to
// public/assets/pine-hollow/baked/site-timbers.bin and the rows to src/shards/pine-hollow/data/siteTimbers.json, which the
// page finishes the timbers from (src/shards/pine-hollow/world/timberSites.ts).
// test/shards/pine-hollow/site-timbers-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-pine-site-timbers.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { bakeSiteTimbers } from '../src/shards/pine-hollow/generators/siteTimbers.ts';
import { shuffleLanes } from '../src/shards/pine-hollow/generators/crags.ts';
import { installPineGround } from './bake-pine-crags.mjs';

const root = resolve(import.meta.dirname, '..');

/** the bake: the rows and the raw binary, over the page's ground */
export function bakeSiteTimberRows() {
  installPineGround();
  const { bin, rows } = bakeSiteTimbers();
  return { rows: { bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, ...rows }, bin };
}

if (import.meta.main) {
  const { rows, bin } = bakeSiteTimberRows();
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const packed = deflateSync(shuffleLanes(bin), { level: 9 });
  writeFileSync(resolve(out, 'site-timbers.bin'), packed);
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/siteTimbers.json'), `${JSON.stringify(rows)}\n`);
  const parts = (r) => r.parts.reduce((n, p) => n + p.counts.length, 0);
  console.info(`pine-hollow site timbers: landing ${String(parts(rows.landing.world))} / ${String(parts(rows.landing.turntable))} parts, bridge ${String(parts(rows.bridge.world))} / ${String(parts(rows.bridge.turntable))}; ${String(bin.length)} → ${String(packed.length)} zlib (baked/site-timbers.bin)`);
}
