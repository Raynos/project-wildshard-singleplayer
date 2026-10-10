// node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs [--check]
// The original fixed builders run offline; no colour quantization, simplification or material conversion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { captainHatGeometry } from './captainHat.ts';
import { boatGeometry } from './boat.ts';
import { sailclothCapeGeometry } from './sailclothCape.ts';
import { chimeGeometry } from './seaGlassChime.ts';

import { plaquesGeometry } from './trophyPlaques.ts';
import { PLAQUE_GAP } from '../models/trophyPlaques.ts';

import { counterGeometry } from './tradeCounter.ts';

import { ironSwordGeometry } from './ironSword.ts';
import { coverGeometry } from './groundCover.ts';
import { originalTrailside } from '../../../../scripts/bake/driftwoodTrailside.mjs';
import { originalCove } from '../../../../scripts/bake/driftwoodCove.mjs';
import { originalHut, originalLookout } from '../../../../scripts/bake/driftwoodHut.mjs';

const assets = new URL('../../../../public/assets/driftwood-isle/baked/fixed-models/', import.meta.url);
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
write(new URL('../data/chimeSlots.json', import.meta.url), `${JSON.stringify(chime.ranges, null, 2)}\n`);
const plaques = plaquesGeometry(PLAQUE_GAP), drop = plaquesGeometry(0);
emit('trophy-plaques', plaques.geometry);
emit('trophy-drop', drop.geometry);
const { ranges, boards, empty, full } = plaques;
write(new URL('../data/trophySlots.json', import.meta.url), `${JSON.stringify({ ranges, boards, empty, full }, null, 2)}\n`);
emit('trade-counter', counterGeometry());
const cover = coverGeometry();
for (const [name, geometry] of Object.entries(cover.geometry)) emit(`cover-${name}`, geometry);
write(new URL('../data/coverLook.json', import.meta.url), `${JSON.stringify(cover.look, null, 2)}\n`);
const cove = originalCove();
for (const [name, geometry] of Object.entries(cove.geometry)) emit(`cove-${name}`, geometry);
write(new URL('../data/coveBake.json', import.meta.url), `${JSON.stringify(cove.metadata, null, 2)}\n`);
const trail = originalTrailside();
emit('trailside', trail.geometry);
write(new URL('../data/trailsideBake.json', import.meta.url), `${JSON.stringify(trail.metadata, null, 2)}\n`);
const hut = originalHut();
emit('hut-kit', hut.kit);
emit('hut-flames', hut.flames);
write(new URL('../data/hutBake.json', import.meta.url), `${JSON.stringify(hut.layout, null, 2)}\n`);
const tower = originalLookout();
emit('lookout', tower.geometry);
write(new URL('../data/lookoutBake.json', import.meta.url), `${JSON.stringify(tower.layout, null, 2)}\n`);
material.dispose();
