// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-driftwood-fixed-models.mjs [--check]
// The original fixed builders run offline; no colour quantization, simplification or material conversion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { captainHatGeometry } from '../src/shards/driftwood-isle/generators/captainHat.ts';
import { boatGeometry } from '../src/shards/driftwood-isle/generators/boat.ts';
import { sailclothCapeGeometry } from '../src/shards/driftwood-isle/generators/sailclothCape.ts';
import { chimeGeometry } from '../src/shards/driftwood-isle/generators/seaGlassChime.ts';

import { plaquesGeometry } from '../src/shards/driftwood-isle/generators/trophyPlaques.ts';
import { PLAQUE_GAP } from '../src/shards/driftwood-isle/models/trophyPlaques.ts';

import { counterGeometry } from '../src/shards/driftwood-isle/generators/tradeCounter.ts';

import { ironSwordGeometry } from '../src/shards/driftwood-isle/generators/ironSword.ts';
import { coverGeometry } from '../src/shards/driftwood-isle/generators/groundCover.ts';

const assets = new URL('../public/assets/driftwood-isle/baked/fixed-models/', import.meta.url);
const check = process.argv.includes('--check');
const write = (url, bytes) => {
  if (existsSync(url) && readFileSync(url).equals(Buffer.from(bytes))) return;
  if (check) { console.error(`bake-fixed-models: STALE ${url.pathname}`); process.exitCode = 1; }
  else writeFileSync(url, bytes);
};
if (!check) mkdirSync(assets, { recursive: true });
const material = new MeshStandardMaterial({ vertexColors: true });
const emit = (name, geometry) => {
  const glb = staticGlb([{ geometry, material, customAttributes: geometry.hasAttribute('aSway') ? { _SWAY: 'aSway' } : {} }], name);
  write(new URL(`${name}.glb`, assets), glb);
  geometry.dispose();
};
for (const [part, geometry] of Object.entries(ironSwordGeometry())) emit(`iron-sword-${part}`, geometry);
emit('captain-hat', captainHatGeometry());
emit('sailcloth-cape', sailclothCapeGeometry());
for (const [part, geometry] of Object.entries(boatGeometry())) emit(`boat-${part}`, geometry);
const chime = chimeGeometry();
emit('sea-glass-chime', chime.geometry);
write(new URL('../src/shards/driftwood-isle/data/chimeSlots.json', import.meta.url), `${JSON.stringify(chime.ranges, null, 2)}\n`);
const plaques = plaquesGeometry(PLAQUE_GAP), drop = plaquesGeometry(0);
emit('trophy-plaques', plaques.geometry);
emit('trophy-drop', drop.geometry);
const { ranges, boards, empty, full } = plaques;
write(new URL('../src/shards/driftwood-isle/data/trophySlots.json', import.meta.url), `${JSON.stringify({ ranges, boards, empty, full }, null, 2)}\n`);
emit('trade-counter', counterGeometry());
const cover = coverGeometry();
for (const [name, geometry] of Object.entries(cover.geometry)) emit(`cover-${name}`, geometry);
write(new URL('../src/shards/driftwood-isle/data/coverLook.json', import.meta.url), `${JSON.stringify(cover.look, null, 2)}\n`);
material.dispose();
