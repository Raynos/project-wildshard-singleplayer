/** Build-time cover splat; the page only admits and installs its declared file. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as v from 'valibot';
import { CoverGrid, triAreas, type CoverTri } from '../world/coverTint';
import { area } from '../world/blenderArea';
import { WORLD_DROP } from '../world/sea';
import { ISLAND_LOOK, ISLAND_TIERS } from '../data/islandRows';
import { encodeFloatBlock, droppedPlacements, placementSets, protosFromMeshes, usedPlacements, type IslandProto } from '../runtime/looks/bakedIsland';
import { coverTrianglesOf, type CoverTriangle } from '../runtime/looks/instancedTiles';
import type { Tier } from '@wildshard/engine/core/tier';

interface CoverMeta { protos: { name: string; kind: string }[]; mustDraw: number }
/** E156 / G144: each cover triangle's centre, ground / upright areas and colour, for CoverGrid.splat, from the instanced
 *  placements (@wildshard/sdk/looks/instancedTiles) in world space */
function* instancedCoverTriangles(tris: Iterable<CoverTriangle>): Generator<CoverTri> {
  const o: CoverTri = { x: 0, z: 0, top: 0, side: 0, r: 0, g: 0, b: 0 };
  for (const t of tris) {
    const ar = triAreas(t.ax, t.ay, t.az, t.bx, t.by, t.bz, t.dx, t.dy, t.dz);
    o.top = ar.top; o.side = ar.side;
    o.x = (t.ax + t.bx + t.dx) / 3; o.z = (t.az + t.bz + t.dz) / 3;
    o.r = t.r; o.g = t.g; o.b = t.b;
    yield o;
  }
}

/** The declared tier-specific cover output. */
export const islandCoverUrl = (tier: Tier): string => (tier === 'phone' ? ISLAND_TIERS.phone.coverUrl : ISLAND_TIERS.desktop.coverUrl);

/** the area's splatted block (`CoverGrid.readBlock`) from the cover sets' triangles */
export function islandCoverBlock(tris: Iterable<CoverTriangle>): Float32Array {
  const grid = new CoverGrid();
  grid.splat(instancedCoverTriangles(tris), area.x0, area.x1, area.z0, area.z1, ISLAND_LOOK.coverDepth);
  return grid.readBlock(area.x0, area.x1, area.z0, area.z1);
}

/** the baked file: a 16-byte header ('WSIC', version, placements used, floats) and the block's f32s, little-endian */
export const encodeIslandCover = (block: Float32Array, used: number): Uint8Array => encodeFloatBlock(block, used, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);

/** the prototypes from island.glb's meshes (world-space positions, Uint8 colour + baked AO), by island.json's index */
export const islandProtos = (found: readonly THREE.Mesh[], meta: CoverMeta): IslandProto[] => protosFromMeshes(found, meta.protos.map((p) => p.name), ISLAND_LOOK.protoPrefix);

/** placements.bin as the build reads it: each placement's y dropped with the world (G164) */
export const islandPlacements = (buf: ArrayBuffer): Float32Array => droppedPlacements(buf, WORLD_DROP);

/** how many placements this tier builds (every palm / rock / log, and the tier's share of the small cover: a prefix) */
export const islandUsed = (f: Float32Array, meta: CoverMeta, phone: boolean): number => usedPlacements(f, meta.mustDraw, phone ? ISLAND_TIERS.phone.share : ISLAND_TIERS.desktop.share);

/**
 * The placements by set and tile: casters CT×CT, small cover and big cover VT×VT; the small rocks rockKit rebuilds.
 * E114: the loose rocks are rockKit's — the boulders (rock*, rockb*: the shore boulders' spots, drawn by Boulders.ts
 * instead) are skipped, the small scattered rocks (smallrock*) rebuilt below. The crag plates on the cliffs (cliff*) stay
 * the Blender ones.
 */
export function islandSets(f: Float32Array, meta: CoverMeta, used: number, phone: boolean): { casters: number[][]; covers: number[][]; bigs: number[][]; smallRocks: number[] } {
  const look = phone ? ISLAND_TIERS.phone : ISLAND_TIERS.desktop;
  const { casters, covers, bigs, apart } = placementSets(f, meta.protos, used, area, { casterTiles: look.casterTiles, coverTiles: look.coverTiles, ...ISLAND_LOOK.names });
  return { casters, covers, bigs, smallRocks: apart };
}

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => o instanceof THREE.Mesh;
async function bakeCover(readAsset: (url: string) => Uint8Array, phone: boolean): Promise<Uint8Array> {
  const base = '/assets/models/driftwood-blender/';
  const meta = v.parse(v.object({ protos: v.array(v.object({ name: v.string(), kind: v.string() })), mustDraw: v.number() }), JSON.parse(new TextDecoder().decode(readAsset(`${base}island.json`))));
  await MeshoptDecoder.ready;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(Uint8Array.from(readAsset(`${base}island.glb`)).buffer, '');
  try {
    gltf.scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse(o => { if (isMesh(o)) meshes.push(o); });
    const protos = islandProtos(meshes, meta), f = islandPlacements(Uint8Array.from(readAsset(`${base}placements.bin`)).buffer);
    const used = islandUsed(f, meta, phone), sets = islandSets(f, meta, used, phone);
    return encodeIslandCover(islandCoverBlock(coverTrianglesOf(protos, f, [sets.covers, sets.bigs])), used);
  } finally {
    gltf.scene.traverse(o => { if (isMesh(o)) { o.geometry.dispose(); for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.dispose(); } });
  }
}

/** Cheap required phone boot file, emitted by the SDK's confined byte producer. */
export const phoneIslandCover = (readAsset: (url: string) => Uint8Array): Promise<Uint8Array> => bakeCover(readAsset, true);
/** Cheap required desktop boot file, emitted by the SDK's confined byte producer. */
export const desktopIslandCover = (readAsset: (url: string) => Uint8Array): Promise<Uint8Array> => bakeCover(readAsset, false);

