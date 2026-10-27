// The open-plots generator's command line (SHARD-PLATFORM SF88g): every idea's world GLB (plotWorld.mjs), then each output's
// data map from its own world. GR9 retires this job once each output's build program bakes its own world and map.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { paintDataMap } from '../../../../scripts/bake-data-maps.mjs';
import { ideaWorld, ideas } from './plotWorld.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REPO = resolve(ROOT, '../../..');
const writeWorld = async (idea) => {
  const bytes = await ideaWorld(idea), out = resolve(ROOT, 'assets', idea.idea);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'world.glb'), bytes);
};

// One world per idea row, then each output's data map from its own world (every world first: the map hash reads them all).
// G641: an idea row with a layout is a tiled plot (kit.mjs, tiledPlot.mjs); the rest keep the hologram showroom
// The same producer supports bounded setup and per-output map proofs. Ordinary
// generation still builds every world before painting every map, in order.
const args = process.argv.slice(2), worldsOnly = args.length === 1 && args[0] === '--worlds-only';
const mapOnly = args.length === 1 && args[0].startsWith('--map-only=') ? args[0].slice('--map-only='.length) : undefined;
if (args.length > 0 && !worldsOnly && (mapOnly === undefined || !ideas.some(idea => idea.slug === mapOnly))) throw new Error('Unknown plot generation selection');
if (mapOnly === undefined) for (const idea of ideas) await writeWorld(idea);
if (!worldsOnly) for (const idea of ideas.filter(row => mapOnly === undefined || row.slug === mapOnly)) await paintDataMap(REPO, 'open-plots', { output: idea.slug, glbs: [`assets/${idea.idea}/world.glb`] });
