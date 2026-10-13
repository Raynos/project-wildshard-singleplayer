import rows from '../data/physicsRows.json' with { type: 'json' };
import { driftwoodGroundRows } from './groundRows';

/** Base64 of a lattice's float32 bytes, as Rapier hands its heightfield back. */
function base64(floats: Float32Array): string {
  const bytes = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCodePoint(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

/** G350-DW: Driftwood's physics product from authoring inputs only: the ground recipe (its native lattice, column-major
 * as Rapier holds it, at its datum, with the authored cells the world carves), and the authored rows no recipe computes
 * yet (solids, actors, herds, habitat, pieces, Captain). No world, model, registry, engine or runtime code runs. */
export function driftwoodPhysics(): Record<string, unknown> {
  const lattice = driftwoodGroundRows(), size = lattice.resolution, heights = new Float32Array(size * size);
  for (let ix = 0; ix < size; ix++) for (let iz = 0; iz < size; iz++) heights[ix * size + iz] = (lattice.heights[iz * size + ix] ?? Number.NaN) + lattice.datum;
  for (const [index = -1, height = Number.NaN] of rows.ground.carve) {
    if (!Number.isInteger(index) || index < 0 || index >= heights.length) throw new Error(`Driftwood physics: carve cell ${String(index)} is off the lattice`);
    heights[index] = height;
  }
  if (heights.some(height => !Number.isFinite(height))) throw new Error('Driftwood physics: the ground lattice is not finite');
  const { carve: _carve, ...ground } = rows.ground;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (driftwood-physics).',
    ground: { ...ground, heights: base64(heights) }, solids: rows.solids, actors: rows.actors, herds: rows.herds, habitat: rows.habitat,
    pieces: rows.pieces, captain: rows.captain };
}
