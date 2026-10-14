#!/usr/bin/env node
// SHARD-PLATFORM W2 C2: Pine Hollow's thralls' glass eyes and fern clumps, baked offline (generators/thrallExtras.ts) on
// each tier's retained rigged hull (src/shards/pine-hollow/assets/creatures/) into one static GLB per tier,
// public/assets/pine-hollow/creatures/thrall-extras[.phone].glb: a node per thrall (`boar_thrall`, `elk_thrall`) with
// position, normal, uv, colour and the `_BONE` / `_GLOW` channels. The page appends them to the hull
// (species/hulls.ts → @wildshard/sdk/looks/riggedHulls `parts`). `--check` refuses a stale GLB.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-thrall-extras.mjs [--check]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { bakeThrallParts } from './thrallExtras.ts';

const root = resolve(import.meta.dirname, '../../../..'), check = process.argv.includes('--check');
const material = new THREE.MeshStandardMaterial({ vertexColors: true });
let stale = false;
for (const tier of /** @type {const} */ (['phone', 'desktop'])) {
  const parts = await bakeThrallParts((file) => Promise.resolve(new Uint8Array(readFileSync(resolve(root, 'src/shards/pine-hollow/assets/creatures', file)))), tier);
  const glb = staticGlb(parts.map(({ name, geometry }) => ({ name, geometry, material, castShadow: true, customAttributes: { _BONE: 'bone', _GLOW: 'glow' }, compactIndex: true })), 'thrall-extras');
  const path = resolve(root, `public/assets/pine-hollow/creatures/thrall-extras${tier === 'phone' ? '.phone' : ''}.glb`);
  if (check) {
    if (!existsSync(path) || Buffer.compare(readFileSync(path), Buffer.from(glb)) !== 0) { console.error(`Pine thrall extras stale: ${path}`); stale = true; }
  } else { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, glb); }
  console.info(`Pine thrall extras (${tier}): ${parts.map(({ name, geometry }) => `${name} ${String(geometry.getAttribute('position').count)} v`).join(', ')}, ${String(glb.length)} bytes${check ? (stale ? ' STALE' : ' match') : ''}`);
}
if (stale) process.exitCode = 1;
