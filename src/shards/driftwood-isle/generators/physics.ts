import { nativeColliderRecordSchema } from '@wildshard/format/nativePhysics';
import * as v from 'valibot';
import rows from '../data/physicsRows.json' with { type: 'json' };
import { driftwoodGroundRows } from './groundRows';

const floorFile = 'data/physics-ground.generated.bin';

/** The original native column-major lattice, datum and authored carve order. */
export function driftwoodPhysicsGroundBytes(): Uint8Array<ArrayBuffer> {
  const lattice = driftwoodGroundRows(), size = lattice.resolution, heights = new Float32Array(size * size);
  for (let ix = 0; ix < size; ix++) for (let iz = 0; iz < size; iz++) heights[ix * size + iz] = (lattice.heights[iz * size + ix] ?? Number.NaN) + lattice.datum;
  for (const [index = -1, height = Number.NaN] of rows.ground.carve) {
    if (!Number.isInteger(index) || index < 0 || index >= heights.length) throw new Error(`Driftwood physics: carve cell ${String(index)} is off the lattice`);
    heights[index] = height;
  }
  if (heights.some(height => !Number.isFinite(height))) throw new Error('Driftwood physics: the ground lattice is not finite');
  return new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength);
}

/** G350-DW: authoring-only native metadata. Original buffers use named binary files; no world or runtime runs. */
export function driftwoodPhysics(): Record<string, unknown> {
  const { carve: _carve, ...ground } = rows.ground;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (driftwood-physics).',
    ground: { ...ground, heights: { file: floorFile } }, solids: rows.solids, actors: rows.actors, herds: rows.herds, habitat: rows.habitat,
    pieces: rows.pieces, captain: rows.captain };
}

/** One registered producer emits the exact native floor bytes beside its metadata. */
export function driftwoodPhysicsFiles(): Map<string, Uint8Array> {
  return new Map([['data/physics.generated.json', new TextEncoder().encode(`${JSON.stringify(driftwoodPhysics())}\n`)], [floorFile, driftwoodPhysicsGroundBytes()]]);
}

/** Original floor and hull buffers through the existing named binary intake. */
export function driftwoodPhysicsSources(): { name: string; kind: 'bin'; source: string; options: { decoded: number } }[] {
  const colliders = new Map<string, number>();
  for (const solid of v.parse(v.array(nativeColliderRecordSchema([1, 2, 9], 'tagged', true)), rows.solids)) {
    for (const range of [solid.vertices, solid.indices]) {
      if (range === undefined) continue;
      if (typeof range === 'string') throw new Error('Driftwood physics requires admitted raw collider ranges');
      colliders.set(range.file, Math.max(colliders.get(range.file) ?? 0, range.byteOffset + range.byteLength));
    }
  }
  return [{ name: floorFile, kind: 'bin', source: floorFile, options: { decoded: (rows.ground.rows + 1) * (rows.ground.cols + 1) * 4 } },
    ...Array.from(colliders, ([name, decoded]) => ({ name, kind: 'bin' as const, source: name, options: { decoded } }))];
}
