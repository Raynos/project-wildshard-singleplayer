import { ConeGeometry, DoubleSide, Group, MeshStandardMaterial, type InstancedMesh } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { fetchInstanceSets, instancedFromSet, type InstanceSet } from '@wildshard/sdk/looks/bakedInstances';
import { paintIsleMaterial } from './isle';
import { skyBakedGeometry } from './baked';
import dressing from '../data/dressing.json' with { type: 'json' };
import { BOULDER_EDITS, CLUMP_EDITS, FLOWER_EDITS } from '../data/dressingLook';
import { DRESSING_URL } from '../boot/files';

/**
 * The island dressing (Gilded Air, review items 6 / 7, loop 2): grass clumps, the rims' lip clumps, flowers, boulders and
 * hanging roots, all instanced, no colliders, one draw each. SHARD-PLATFORM M3: placed offline (`generators/dressing.ts`,
 * `scripts/bake-sky-world.mjs` → `baked/dressing.bin` + `data/dressing.json`); the page draws the baked matrices and
 * colours in the shapes of the geometries bake and its own materials (their edits are data/dressingLook.ts).
 */

let loaded: ReadonlyMap<string, InstanceSet> = new Map();
/** Load the dressing bake (with the other baked pieces, before the world is built); a failed load draws no dressing. */
export async function loadSkyDressing(): Promise<void> {
  try { loaded = await fetchInstanceSets(DRESSING_URL, dressing.sets); } catch (e: unknown) { console.warn('[far-reach] dressing not loaded:', e); }
}

/** The hero boulders and the meadow's larger rocks, as discs (x, z, radius) for the meadow's short grass round them. */
export function heroStoneDiscs(): [number, number, number][] {
  return dressing.discs.map(([x = 0, z = 0, r = 0]) => [x, z, r]);
}

/** The dressing's draws. */
export interface Dressing { readonly group: Group; readonly meshes: readonly InstancedMesh[] }

/** The playable islands' dressing from its bake (`sets` defaults to the loaded one; a test passes its own). */
export function dressIslands(sets: ReadonlyMap<string, InstanceSet> = loaded): Dressing {
  // (the boulder's copy first, the clumps' after it: the page made its shapes in this order)
  const stone = skyBakedGeometry('boulder'); stone.computeBoundingBox();
  const group = new Group(), meshes: InstancedMesh[] = [];
  const add = (mesh: InstancedMesh, box = true): InstancedMesh => {
    mesh.computeBoundingSphere(); if (box) mesh.computeBoundingBox(); group.add(mesh); meshes.push(mesh); return mesh;
  };
  // the clumps carry the meadow beyond the near field (world/meadow.ts); inside it they shrink away so the fine blades own the foreground
  const clumpMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0 });
  patchShader(clumpMaterial, 'far.clump-handoff', PATCH_ORDER.decorate, (shader) => { editShader(shader, CLUMP_EDITS); }, { key: (prior) => `${prior}|far.clump-handoff` });
  add(instancedFromSet(skyBakedGeometry('clump'), clumpMaterial, sets.get('clump')));
  // the lip clumps lean out over every rim, and shrink away near the camera like the clumps (E407 row 4)
  add(instancedFromSet(skyBakedGeometry('clump'), clumpMaterial, sets.get('lip')), false);
  // the near meadow draws its own flowers (world/meadow.ts): these grow in past it
  const flowerMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, metalness: 0, emissive: 0x2a2418 });
  patchShader(flowerMaterial, 'far.flower-handoff', PATCH_ORDER.decorate, (shader) => { editShader(shader, FLOWER_EDITS); }, { key: (prior) => `${prior}|far.flower-handoff` });
  add(instancedFromSet(skyBakedGeometry('flower'), flowerMaterial, sets.get('flower')));
  // the boulders wear the islands' painted rock and moss, with their own near detail over it (E392)
  const stoneMaterial = paintIsleMaterial(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }));
  patchShader(stoneMaterial, 'far.boulder-detail', PATCH_ORDER.decorate + 10, (shader) => { editShader(shader, BOULDER_EDITS); }, { key: (prior) => `${prior}|far.boulder-detail` });
  add(instancedFromSet(stone, stoneMaterial, sets.get('stone')));
  // a strand 1 m long, tip down: its wide end at y 0 hangs from the rim band; instances stretch it to their length
  const strand = new ConeGeometry(0.16, 1, 5, 1, true); strand.rotateX(Math.PI); strand.translate(0, -0.5, 0);
  add(instancedFromSet(strand, new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: DoubleSide }), sets.get('root')));
  return { group, meshes };
}
