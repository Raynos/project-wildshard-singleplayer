import * as THREE from 'three';
import type { TerrainPainter, WorldLookContext } from '@wildshard/engine/render/look';
import type { Terrain } from '@wildshard/engine/world/Terrain';
import { bindLowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { FacetedGroundRow } from './rows';
import { coverAttributes } from './coverGrid';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { readDriftwoodBlob } from '../boot/blobAssets';

/**
 * A faceted, texture-free ground as a terrain painter (SHARD-PLATFORM M3, look-family rows; W2 C2 baked it): the level's
 * heightfield as ONE indexed grid worn by the shard's graph material (flat-shaded, its colour a `flat` varying, so each
 * triangle takes its provoking (last) vertex's colour: solid facets with no per-vertex duplication; the phone is
 * vertex-bound), and the chunk's slab walls. Two draw calls, no maps. The grid, its paint and the slab are built offline
 * (generators/facetedGround.ts, the driftwood-faceted-ground job, on the bound native ground); this decodes the one
 * hash-named GLBs (ground, slab). The look compiles the two graph materials before the ground builds and lends them for its world's
 * scope:
 *
 *   look.prepareWorld = (context) => prepareFacetedGround(context, source, row, followToon);
 *   look.terrainPainter = facetedGroundPainter(GROUND_FILES);
 */

type ToonLookOf = Awaited<ReturnType<typeof runtimeLookMaterials>>['toon'];
/** a world's compiled ground materials and their toon look's once-a-frame follow of the day clock */
interface GroundLoan { readonly ground: THREE.Material; readonly slab: THREE.Material; readonly follow: () => void }
/** the live loans, newest last (a world's scope removes its own) */
const loans: GroundLoan[] = [];

/** Compile the row's graph materials under the world's scope and lend them to the next ground built (a look's
 *  `prepareWorld`); `follow` makes their toon look track the shard's day clock once a frame. `kit` (variant → graph id)
 *  compiles the shard's low-poly kit graphs in the same pass and binds each to its kit variant for the world's scope. */
export async function prepareFacetedGround(context: WorldLookContext, source: Shardfile, row: FacetedGroundRow, follow: (toon: ToonLookOf) => () => void, kit: Readonly<Record<string, string>> = {}): Promise<void> {
  const { materials, toon } = await runtimeLookMaterials(context, source, true, [row.materials.ground, row.materials.slab, ...Object.values(kit)]);
  const ground = materials.get(row.materials.ground), slab = materials.get(row.materials.slab);
  if (ground === undefined || slab === undefined) throw new Error('Faceted ground: look.materials lacks its graphs');
  Object.entries(kit).forEach(([variant, id]) => {
    const material = materials.get(id); if (material === undefined) throw new Error(`Faceted ground: look.materials lacks the kit graph ${id}`);
    bindLowPolyMaterial(context.sky, variant, material, context.scope);
  });
  const loan: GroundLoan = { ground, slab, follow: follow(toon) };
  loans.push(loan);
  context.scope.onDispose(() => { const at = loans.indexOf(loan); if (at !== -1) loans.splice(at, 1); });
}

/** A terrain painter that lays the baked faceted ground (its grid's and slab's GLBs) in the lent materials. */
export function facetedGroundPainter(urls: { readonly ground: string; readonly slab: string }): TerrainPainter {
  return { build: (t, f) => buildFacetedGround(t, f, urls) };
}

async function buildFacetedGround(t: Terrain, f: Parameters<TerrainPainter['build']>[1], urls: { readonly ground: string; readonly slab: string }): Promise<void> {
  await f.ready();
  const loan = loans.at(-1);
  if (loan === undefined) throw new Error('Faceted ground: no graph materials lent (the look prepares them before the ground builds)');
  const grid = modelGeometry(urls.ground), walls = modelGeometry(urls.slab);
  await Promise.all([
    readDriftwoodBlob(urls.ground).then(bytes => grid.load(bytes)),
    readDriftwoodBlob(urls.slab).then(bytes => walls.load(bytes)),
  ]);
  const ground = grid.take(), slab = walls.take();
  coverAttributes(ground, ground.getAttribute('position').count); // the graph reads the cover tint's attributes (zero until tintTerrain fills them)
  t.mesh = new THREE.Mesh(ground, loan.ground);
  t.mesh.receiveShadow = true;
  t.mesh.castShadow = true;
  t.mesh.onBeforeRender = loan.follow; // the ground draws every frame: its toon look follows the day clock here
  t.group.add(t.mesh);
  const sides = new THREE.Mesh(slab, loan.slab);
  sides.receiveShadow = true;
  t.group.add(sides);
}
