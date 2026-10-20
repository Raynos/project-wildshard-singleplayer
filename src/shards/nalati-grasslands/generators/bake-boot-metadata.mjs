import { postChainRows } from './postChain.ts';
import { PANO_RIDGE_V } from './panoramaData.ts';
import { manifestDeclaration } from '../../../../scripts/manifest-declaration.mjs';
import paintedTextures from '../data/paintedTextures.json' with { type: 'json' };
import discovery from '../data/discovery.json' with { type: 'json' };
import { NALATI_MAP, SNOW_LINE, GLACIER } from './layout.ts';
import { nalatiDayClockRow } from './dayClock.ts';
import { NALATI_MANIFEST_ROWS } from './manifestRows.ts';
import { NALATI_BUDGET_INPUTS } from './budgets.ts';
import { NALATI_HORIZON_V2 } from './horizon.ts';
import strings from '../data/strings.json' with { type: 'json' };
import { NALATI_GRASS_LAYOUT } from './grassFieldLayout.ts';
import runtimeCost from '../data/runtimeCost.json' with { type: 'json' };
// Boot metadata exists before product admission; author recipes never enter the client bundle.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { nalatiBootInventory } from './bootInventory.ts';
import * as v from 'valibot';

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
const writer = byteWriter(process.argv.includes('--check'), 'nalati-boot-metadata');
writer.put(resolve(root, 'src/shards/nalati-grasslands/bootMetadata.generated.json'), jsonBytes({ ...nalatiBootInventory(ordered), dayClock: nalatiDayClockRow(), postChain: postChainRows(), runtimeCost, strings, grassLayout: NALATI_GRASS_LAYOUT, manifest: NALATI_MANIFEST_ROWS, budgets: NALATI_BUDGET_INPUTS, horizon: NALATI_HORIZON_V2, panoramaRidge: PANO_RIDGE_V }));
const { captureProbes: _captureProbes, extraArt, ...fixed } = discovery;
const inventory = nalatiBootInventory(ordered);
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/declaration.generated.ts'), manifestDeclaration(root, 'nalati-grasslands', {
  ...NALATI_MANIFEST_ROWS, ...fixed, budgets: NALATI_BUDGET_INPUTS, runtimeCost,
  horizon: NALATI_HORIZON_V2,
  pois: NALATI_MAP.pois.map(p => ({ id: p.label.toLowerCase().replaceAll(' ', '-'), name: p.label.charAt(0) + p.label.slice(1).toLowerCase(), x: p.x, z: p.z, r: 24 })),
  minimap: { image: '/assets/nalati-grasslands/map/top.webp' },
  boot: { ...fixed.boot, files: inventory.files, sources: inventory.sources, steps: inventory.steps, lateReads: inventory.lateReads, explore: { art: [...Object.values(fixed.explore.art), ...extraArt, ...fixed.explore.compare.flatMap(({ live, image }) => [live, image])] } },
}, ['load', 'ground', 'seed', 'spawn', 'slug']));
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
writer.put(resolve(root, 'src/shards/nalati-grasslands/boot/paintedTextures.generated.json'), jsonBytes({ ...paintedTextures, ground, panorama, key, world }));
writer.finish();
