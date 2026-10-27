import type { ColliderDesc } from '@wildshard/sdk/bake/placement';
import { encodeBuildBytes } from '@wildshard/sdk/bake/byteCodec';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { bakeCragRockOnTerrain, type CragRockBake } from './places';
import { join, writeGeometry, type PlaceGeometryRow } from './geometryWriter';

/** One tier's crag rows: the shapes by bank offset, the private scene recipe, placements, boxes, colliders and hulls. */
export interface NalatiCragTier {
  meshes: { key: string; offset: number; row: PlaceGeometryRow }[];
  recipe: { version: 1; root: string; materials: { kind: 'port'; id: string; source: string }[]; nodes: unknown[] };
  placements: CragRockBake['placements']; boxes: number[]; colliders: CragRockBake['colliders'];
  count: CragRockBake['count']; triangles: number; hulls: { x: number; y: number; z: number; points: number[] }[];
}
export interface NalatiCragRows { phone: NalatiCragTier; desktop: NalatiCragTier }

const LATTICE = '/assets/baked/nalati-grasslands/terrain.bin', BANK = '/assets/nalati/baked/crags.bin';
const hull = (row: ColliderDesc): NalatiCragTier['hulls'][number] => {
  if (row.kind !== 'hull') throw new Error('Crag bake requires the original support hulls');
  return { x: row.x, y: row.y, z: row.z, points: Array.from(row.points) };
};

/**
 * GR6: Nalati's crag rock over the native lattice, both tiers (the retired nalati-crags job's construction): `rows` as its
 * readers parse them, and `bin`, the shapes' lane-shuffled level-9 deflate bank committed at public/assets/nalati/baked/
 * crags.bin (rewritten by hand with bake-crag-rock.mjs when the crags change).
 */
export function nalatiCragRock(terrain: Uint8Array): { rows: NalatiCragRows; bin: Uint8Array } {
  const blocks: Uint8Array[] = [];
  let offset = 0;
  const build = (tier: 'phone' | 'desktop'): NalatiCragTier => {
    const made = bakeCragRockOnTerrain(tier === 'phone', terrain);
    const meshes = made.meshes.map(({ name, geometry }) => {
      const key = `crag:${tier}:${name}`, start = blocks.length;
      const part = { key, offset, row: writeGeometry(geometry, blocks, key) };
      offset += blocks.slice(start).reduce((bytes, block) => bytes + block.length, 0);
      geometry.dispose();
      return part;
    });
    return { meshes, recipe: { version: 1, root: 'root', materials: [{ kind: 'port', id: 'crag', source: 'crag' }],
      nodes: [{ kind: 'group', id: 'root', name: 'nalati-crag-rock', children: made.meshes.map(row => row.name) },
        ...made.meshes.map((row, i) => ({ kind: 'mesh', id: row.name, name: row.name, geometry: meshes[i]?.key,
          material: 'crag', missing: 'omit', castShadow: true, receiveShadow: true }))] },
      placements: made.placements, boxes: made.boxes, colliders: made.colliders, count: made.count, triangles: made.triangles,
      hulls: made.descs.map(hull) };
  };
  const rows = { phone: build('phone'), desktop: build('desktop') }, raw = join(blocks);
  const lanes = new Uint8Array(raw.length), words = raw.length / 4;
  for (let i = 0; i < words; i++) for (let b = 0; b < 4; b++) lanes[b * words + i] = raw[i * 4 + b] ?? 0;
  return { rows, bin: encodeBuildBytes(lanes, 'deflate', 9, 'native') };
}

/** The crag rows at build time over the lattice, after checking the committed bank is this construction's bytes. */
export async function nalatiCragRockProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<NalatiCragRows> {
  const files = await ctx.cached({ id: 'crag-rock-inputs', inputs: [LATTICE, BANK] }, inputs => {
    const lattice = inputs.get(LATTICE), bank = inputs.get(BANK);
    if (lattice === undefined || bank === undefined) throw new Error('Missing Nalati crag inputs');
    return new Map([['lattice.bin', lattice], ['crags.bin', bank]]);
  });
  const lattice = files.get('lattice.bin'), committed = files.get('crags.bin');
  if (lattice === undefined || committed === undefined) throw new Error('Missing Nalati crag inputs');
  const made = nalatiCragRock(lattice);
  if (made.bin.length !== committed.length || made.bin.some((value, i) => value !== committed[i]))
    throw new Error('Committed crags.bin differs from the crag construction: run bake-crag-rock.mjs');
  return made.rows;
}
