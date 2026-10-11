import { mkdirSync, writeFileSync } from 'node:fs';
import { buildWorld, disposeWorld, worldBytes } from './generators/world.ts';

const scene = buildWorld();
try {
  mkdirSync('assets', { recursive: true });
  writeFileSync('assets/world.glb', worldBytes(scene));
} finally { disposeWorld(scene); }
