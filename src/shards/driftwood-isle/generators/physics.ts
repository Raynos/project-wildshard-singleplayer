import { nameBlob, emitNamedBlobs, type EmittedBlobs } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { nativeColliderSourceRows } from '@wildshard/sdk/formatJsonSchema';
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

export type DriftwoodPhysics = Pick<typeof rows, 'solids' | 'actors' | 'herds' | 'habitat' | 'pieces' | 'captain'> & {
  version: 1; profile: string; notice: string; ground: Omit<typeof rows.ground, 'carve'> & { heights: { file: string } };
};

/** G350-DW: authoring-only native metadata. Original buffers use named binary files; no world or runtime runs. */
export function driftwoodPhysics(): DriftwoodPhysics {
  const { carve: _carve, ...ground } = rows.ground;
  return { version: 1, profile: 'authored rows', notice: 'DO NOT EDIT: regenerate with generators/physics.ts (driftwood-physics).',
    ground: { ...ground, heights: { file: floorFile } }, solids: rows.solids, actors: rows.actors, herds: rows.herds, habitat: rows.habitat,
    pieces: rows.pieces, captain: rows.captain };
}

/** The original carved floor enters the product as owned bytes, without a source-file handoff. */
export function driftwoodPhysicsFloor(): ReturnType<typeof nameBlob> {
  return nameBlob(floorFile, 'bin', driftwoodPhysicsGroundBytes(), { decoded: (rows.ground.rows + 1) * (rows.ground.cols + 1) * 4 });
}

/** Authored immutable hull buffers through the existing named binary intake. */
export function driftwoodPhysicsSources(): { name: string; kind: 'bin'; source: string; options: { decoded: number } }[] {
  const colliders = new Map<string, number>();
  for (const solid of nativeColliderSourceRows(rows.solids, [1, 2, 9], 'tagged')) {
    for (const range of [solid.vertices, solid.indices]) {
      if (range === undefined) continue;
      if (typeof range === 'string') throw new Error('Driftwood physics requires admitted raw collider ranges');
      colliders.set(range.file, Math.max(colliders.get(range.file) ?? 0, range.byteOffset + range.byteLength));
    }
  }
  return Array.from(colliders, ([name, decoded]) => ({ name, kind: 'bin' as const, source: name, options: { decoded } }));
}

/** Publish the original tracked proof hulls through the explicit source reader.
 * Owned file identities let timing refer to their real hashes, never pins. */
export async function driftwoodPhysicsOwnedSources(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<EmittedBlobs> {
  const sources = driftwoodPhysicsSources();
  const files = await ctx.cached({ id: 'native-proof-hulls', inputs: sources.map(row => row.source) }, inputs => {
    if (inputs.size !== sources.length || sources.some(row => (inputs.get(row.source)?.byteLength ?? 0) === 0)) throw new Error('Driftwood proof hull inventory differs');
    return new Map(inputs);
  });
  return emitNamedBlobs(sources.map(row => {
    const bytes = files.get(row.source);
    if (bytes === undefined) throw new Error('Missing Driftwood proof hull bytes');
    return nameBlob(row.name, row.kind, bytes, row.options);
  }));
}

/** Only native proof consumers borrow this bank. Required and shared readers
 * still win through the common control-file selector. All costs stay declared. */
export function driftwoodProofLateRoots(files: readonly { readonly name?: string; readonly hash: string }[]): { hash: string }[] {
  const names = ['sim/headless-assembly.json', floorFile, ...driftwoodPhysicsSources().map(row => row.name)];
  return [...new Set(names.map(name => {
    const file = files.find(row => row.name === name);
    if (file === undefined) throw new Error(`Missing Driftwood proof file: ${name}`);
    return file.hash;
  }))].map(hash => ({ hash }));
}
