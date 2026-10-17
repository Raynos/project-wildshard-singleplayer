#!/usr/bin/env node
// Cheap deterministic world-scene sources: restore the retained native water and bake the existing spray quad offline.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PlaneGeometry, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { streamGeometry } from './streamCodec.ts';
import streamRows from '../data/streams.json' with { type: 'json' };
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { fileURLToPath } from 'node:url';

const project = new URL('../', import.meta.url);
const lanes = inflateSync(readFileSync(new URL('../../../../public/assets/pine-hollow/baked/streams.bin', import.meta.url)));
const original = new Uint8Array(lanes.length), words = lanes.length / 4;
for (let i = 0; i < words; i++) for (let byte = 0; byte < 4; byte++) original[i * 4 + byte] = lanes[byte * words + i] ?? 0;
const water = streamGeometry(original, streamRows), quad = new PlaneGeometry(1, 1), placeholder = new MeshStandardMaterial();
const writer = byteWriter(process.argv.includes('--check'), 'pine-scene-models');
try {
  writer.put(fileURLToPath(new URL('assets/stream-scenes/water.glb', project)), staticGlb([{ geometry: water, material: placeholder, compactIndex: true, customAttributes: { _AWATER: 'aWater' } }]));
  writer.put(fileURLToPath(new URL('assets/stream-scenes/quad.glb', project)), staticGlb([{ geometry: quad, material: placeholder, compactIndex: true }]));
  writer.finish();
} finally { water.dispose(); quad.dispose(); placeholder.dispose(); }
