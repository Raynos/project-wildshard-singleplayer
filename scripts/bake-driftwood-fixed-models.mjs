// node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-driftwood-fixed-models.mjs [--check]
// The original fixed builders run offline; no colour quantization, simplification or material conversion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { captainHatGeometry } from '../src/shards/driftwood-isle/generators/captainHat.ts';
import { boatGeometry } from '../src/shards/driftwood-isle/generators/boat.ts';
import { sailclothCapeGeometry } from '../src/shards/driftwood-isle/generators/sailclothCape.ts';
import { chimeGeometry } from '../src/shards/driftwood-isle/generators/seaGlassChime.ts';

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
emit('captain-hat', captainHatGeometry());
emit('sailcloth-cape', sailclothCapeGeometry());
for (const [part, geometry] of Object.entries(boatGeometry())) emit(`boat-${part}`, geometry);
const chime = chimeGeometry();
emit('sea-glass-chime', chime.geometry);
write(new URL('../src/shards/driftwood-isle/data/chimeSlots.json', import.meta.url), `${JSON.stringify(chime.ranges, null, 2)}\n`);
material.dispose();
