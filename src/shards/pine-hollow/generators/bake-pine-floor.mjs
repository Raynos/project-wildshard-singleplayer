// GR8 G24: the forest floor's placements over the page's baked ground, quantised to the 12-byte records the floor
// binary stored and decoded as the page read them. `output.ts` (world/floor.json), the map assembly and the floor test
// call `pineFloorLayout`; the retired pine-floor-placements job wrote the same rows to data/floorLayout.generated.json.
// D65: the ground and the trunk rows come from the program's sources.
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { decodeFloorRecords } from './floorRows.mjs';
import { pineFloorPlacements } from './floorPlacements.ts';
import { PHYSICS_SOURCE, TERRAIN_SOURCE, sourceJson } from './pineSources.ts';

const kinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'];
const tints = [[.5, .78], [.8, 1], [.7, .9], [.75, 1], [.6, .85], [.75, 1]];

/** The floor's counts per kind and its decoded layout. */
export function pineFloorLayout(sources) {
  const source = readNativeTerrain(sources.bytes(TERRAIN_SOURCE));
  const trunks = sourceJson(sources, PHYSICS_SOURCE).shelterTrees.map(([x, z, r]) => ({ x, z, r }));
  const pass = pineFloorPlacements(trunks, source);
  let step = pass.next(); while (!step.done) step = pass.next();
  const places = step.value, counts = kinds.map(kind => places[kind].length), count = counts.reduce((n, k) => n + k, 0);
  const raw = new Uint8Array(32 + count * 12), view = new DataView(raw.buffer);
  view.setUint32(0, 0x46555357, true); view.setUint32(4, 2, true); counts.forEach((n, i) => view.setUint32(8 + i * 4, n, true));
  let offset = 32;
  for (const [kindIndex, kind] of kinds.entries()) for (const row of places[kind]) {
    const tint = tints[kindIndex];
    view.setUint16(offset, Math.round((row.x + 250) / 500 * 65535), true); view.setUint16(offset + 2, Math.round((row.y + 128) / 256 * 65535), true); view.setUint16(offset + 4, Math.round((row.z + 250) / 500 * 65535), true);
    view.setUint16(offset + 6, Math.round(row.rot / (2 * Math.PI) * 65535), true); view.setInt8(offset + 8, Math.round(row.nx * 127)); view.setInt8(offset + 9, Math.round(row.nz * 127));
    view.setUint8(offset + 10, Math.round((row.scale - .5) * 200)); view.setUint8(offset + 11, Math.round((row.r - tint[0]) / (tint[1] - tint[0]) * 255)); offset += 12;
  }
  return { counts, layout: decodeFloorRecords(raw, counts) };
}
