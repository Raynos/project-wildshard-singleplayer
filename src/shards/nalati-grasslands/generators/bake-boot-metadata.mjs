import { postChainRows } from './postChain.ts';
import { PANO_RIDGE_V } from './panoramaData.ts';
import { manifestDeclaration } from '../../../../scripts/manifest-declaration.mjs';
import paintedTextures from '../data/paintedTextures.json' with { type: 'json' };
import discovery from '../data/discovery.json' with { type: 'json' };
import { NALATI_MAP, SNOW_LINE, GLACIER } from './layout.ts';
import { NALATI_MANIFEST_ROWS } from './manifestRows.ts';
import budgetInputs from '../data/budgetInputs.json' with { type: 'json' };
import ceilings from '../data/budgetCeilings.json' with { type: 'json' };
import { NALATI_HORIZON_V2 } from './horizon.ts';
import runtimeCost from '../data/runtimeCost.json' with { type: 'json' };
// Boot metadata exists before product admission; author recipes never enter the client bundle.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { nalatiBootInventory } from './bootInventory.ts';
import * as v from 'valibot';

/** @type {import('@wildshard/engine/level/spec').LevelSpec['budgets']} */
const NALATI_BUDGET_INPUTS = { ceilings, ...budgetInputs };

const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Only these authored public trees affect recipe presence and phone fallbacks. */
const roots = ['assets/nalati', 'assets/baked/nalati-grasslands', 'assets/baked/common', 'assets/gpu/nalati'];
/** @type {Record<string,number | true>} */
const bytes = {};
for (const folder of roots) for (const file of readdirSync(resolve(root, 'public', folder), { recursive: true, withFileTypes: true })) {
  if (file.isFile()) {
    const path = resolve(file.parentPath, file.name);
    bytes[`/${path.slice(resolve(root, 'public').length + 1)}`] = statSync(path).size;
  }
}
// Generation verifies and publishes these outputs before writing PUBLIC_BYTES.
// Their declared presence is independent of which cache outputs a warm slot retains.
const catalogue = v.parse(v.object({ jobs: v.array(v.object({
  buildOutputs: v.optional(v.record(v.string(), v.string()), {}),
  buildTimeOutputs: v.optional(v.array(v.string()), []),
})) }), JSON.parse(readFileSync(resolve(root, 'scripts/generation-jobs.json'), 'utf8')));
for (const job of catalogue.jobs) for (const path of [...Object.keys(job.buildOutputs), ...job.buildTimeOutputs]) {
  if (path.startsWith('public/assets/')) bytes[path.slice('public'.length)] = true;
}
// The page's generated PUBLIC_BYTES table has this exact lexical ordering.
const ordered = Object.fromEntries(Object.keys(bytes).filter(path => !path.endsWith('.DS_Store')).sort().map(path => [path, bytes[path]]));
const inventory = nalatiBootInventory(ordered);
const writer = byteWriter(process.argv.includes('--check'), 'nalati-boot-metadata');
writer.put(resolve(root, 'src/shards/nalati-grasslands/bootMetadata.generated.json'), jsonBytes({ assetFiles: inventory.assetFiles, postChain: postChainRows(), panoramaRidge: PANO_RIDGE_V }));
const { captureProbes: _captureProbes, extraArt, ...fixed } = discovery;
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/declaration.generated.ts'), `${manifestDeclaration(root, 'nalati-grasslands', {
  ...NALATI_MANIFEST_ROWS, ...fixed, budgets: NALATI_BUDGET_INPUTS, runtimeCost,
  horizon: NALATI_HORIZON_V2,
  pois: NALATI_MAP.pois.map(p => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })),
  minimap: { image: '/assets/nalati-grasslands/map/top.webp' },
  boot: { ...fixed.boot, files: inventory.files, sources: inventory.sources, steps: inventory.steps, lateReads: inventory.lateReads, explore: { art: [...Object.values(fixed.explore.art), ...extraArt, ...fixed.explore.compare.flatMap(({ live, image }) => [live, image])] } },
}, ['load', 'ground', 'seed', 'spawn', 'slug'])}
import geography from './geography.generated.json' with { type: 'json' };
export const TERRAIN_ROWS = {
  seed: geography.seed,spawn: geography.spawn,
  groundRows: geography.ground,groundColourSamples: geography.pigment,surfaceSamples: geography.surface,
  forestMaskSamples: geography.channels.forest,
  mapGroundSamples: [geography.channels.mapRed,geography.channels.mapGreen,geography.channels.mapBlue],
  minimap: { palette: geography.map },
  navmesh: { ground: { waterMargin: .25,wet: geography.channels.wet,wetThreshold: .5,trailClearance: 3.5 } },
} satisfies Pick<import('@wildshard/game/shard/manifest').ShardManifestRows,
  'seed'|'spawn'|'groundRows'|'groundColourSamples'|'surfaceSamples'|'forestMaskSamples'|'mapGroundSamples'|'minimap'|'navmesh'>;
`);
// the painted ground (game/looks/painterlyLook paintedGroundPainter): the meadow, path, gravel, rock and snow tiles, the snow
// line, the wet low ground and the glacier's ice, in a softly banded painterly material recoloured by the terrain graph
const m = paintedTextures.metres, ground = { layers: ['meadow', 'path', 'gravel', 'rock', 'snow'], colour: 'terrain', material: { bands: 0.5, rim: 0, shade: 0.85 },
  surface: { maps: { base: 'meadow', track: 'path', gravel: 'gravel', rock: 'rock', snow: 'snow' }, metres: { base: m.meadow, track: m.path, gravel: m.gravel, rock: m.rock, snow: m.snow },
    means: { base: [...paintedTextures.mean.meadow], rock: [...paintedTextures.mean.rock] }, snow: { line: SNOW_LINE, high: [44, 84] }, wet: [-9.2, -9.9],
    ice: { from: [GLACIER.x0, GLACIER.z0], to: [GLACIER.x1, GLACIER.z1], half: GLACIER.half } },
  shapes: ['ground', 'slab'], recipe: { file: 'world/water.json', key: 'terrain' }, mesh: 'ground', tiles: true };
// the painted panorama (game/looks/painterlyLook PaintedPanorama): the painting as the sky dome (drawn first, just inside the far
// plane), the cloud sea sunk below the rim, and the lit look graphs that hear the painterly world's shade, rim and wet
const panorama = { dome: { name: 'sky-dome-v2', look: 'nalati-panorama', image: paintedTextures.panorama, pad: 16, fallbackWidth: 6176, zenith: paintedTextures.zenith,
    radius: 2590, segments: [96, 48], order: -90, night: [2, -9], params: { image: 'tPano', ridge: 'tRidge', lut: 'tFogLut', pad: 'uPad', zenith: 'uZenith', sun: 'uSunNow', night: 'uNight' } },
  sea: { name: 'cloud-sea', look: 'nalati-cloud-sea', y: -68, lut: 'tFogLut', sun: 'uSunView' },
  lit: { looks: ['nalati-crag', 'nalati-crag-phone', 'nalati-riders', 'nalati-cloth'], shade: 'shade', rim: 'rim', wet: 'wet' } };
// the painter's key (game/looks/painterlyLook PainterKeyLight): the painting's sun sits low in the WSW and the camp looks toward
// it, so the light that shades the world swings 40° further round and 15° higher (easing onto the real sun as it sets); the
// fill lower and cooler, a blue sky above and an olive bounce below
const key = { turn: 40, lift: 15, ease: [-1, 12], sky: [0.4, 0.46, 0.62], ground: [0.3, 0.3, 0.16], mix: 0.4, fill: 0.95 };
// the painterly world (game/looks/painterlyLook PainterlyWorld): the static capture of the places, the dressing, the outcrops
// and the crags (and the spruce), swept every 2 s; the phone's live shadow map holds only what moves at 512²; dusk over 12°…0°
const world = { casters: ['pois', 'dressing', 'outcrops', 'crags'], sweep: 2, liveMap: 512, dusk: [12, 0] };
// the painted fog (engine/world/Atmosphere ColourRampFog with a panorama; look/render.ts): fogged materials fade into the
// painting's haze straight behind them. Clear to 30 m, then 1 − exp(−(d − 30) · 0.0032), thinner with the ray's mean height
// above the valley floor (−10 m), plus the day's aerial density (0.002) and whatever the weather adds. aerial = density,
// clear distance, valley floor, day density. edge (N19, "make this far background transition super smooth and
// invisible"): past the slab (N23's berm is the skyline) the ground and rings thicken into the same haze, strength 0.95
// from 251 to 270 m from the slab centre, only beyond 20 m of view distance (a player by the edge still sees his feet)
const fog = { start: 30, end: 600, aerial: [0.0032, 30, -10, 0.002], edge: [0.95, 251, 270, 20] };
// soft cloud shadows (game/looks/paintedLook paintedAir): a 520 m tile, cover past 0.53 (± 0.06) takes 0.66 of the sun,
// drifting at 1.6 × the wind + 2 m/s
const air = { tile: 520, threshold: 0.53, strength: 0.66, softness: 0.06, drift: [1.6, 2] };
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/paintedTextures.generated.json'), jsonBytes({ ...paintedTextures, ground, panorama, key, world, fog, air }));
writer.finish();
