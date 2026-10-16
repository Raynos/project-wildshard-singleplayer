import * as THREE from 'three';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { GraphLiteral } from '@wildshard/format/materialGraph';

/**
 * A baked island's generic parts (SHARD-PLATFORM M3; ex a shard's Blender-island install): an area of the world rebuilt
 * from an offline bake (terrain tiles with baked AO and bounce lightmaps, prototypes and their placements) over the
 * procedural ground it replaces. The shard keeps what is its own — its files, its area, its models and colliders — and
 * gives its looks as graph toon materials (data/islandLook.ts) and rows: the tile counts and the name patterns that sort
 * the placements.
 *
 * - `setIslandLooks` / `islandLooks`: the compiled graph looks the runtime lends the island before the world builds.
 * - `clipGridTerrain`: install the authored terrain clipping facts.
 * - `sunBounceLevel`: how much of the baked bounce the live sun lights.
 * The prototypes, their far copies (simplified at build) and the cover splat are baked (generators/islandCover.ts).
 */

/** The island's compiled graph looks (look.materials, data/islandLook.ts) with their param / texture writers and their toon
 *  look's once-a-frame follow of the day clock. */
export interface IslandLooks {
  readonly material: (id: string) => THREE.Material;
  readonly param: (id: string, name: string, value: GraphLiteral) => void;
  readonly texture: (id: string, name: string, texture: THREE.Texture) => void;
  readonly follow: () => void;
}
let lent: IslandLooks | null = null;

/** Hand the island its compiled graph looks, their writers and their toon look's follow, before the world builds. */
export function setIslandLooks(materials: ReadonlyMap<string, THREE.Material>, param: IslandLooks['param'], texture: IslandLooks['texture'], follow: () => void): void {
  lent = { follow, param, texture, material: (id) => { const m = materials.get(id); if (m === undefined) throw new Error(`Baked island: look.materials lacks ${id}`); return m; } };
}

/** The island's lent looks; throws when the runtime lent none (there is no classic stand-in). */
export function islandLooks(): IslandLooks {
  if (lent === null) throw new Error('Baked island: no graph looks lent (the runtime compiles them before the world builds)');
  return lent;
}

/** The authored grid's retained index runs (the product's `custom/islandClips`). */
export interface IslandTerrainClip { readonly sourceVertices: number; readonly sourceIndices: number; readonly outputIndices: number; readonly ranges: readonly { readonly start: number; readonly count: number }[] }

/** Install the authored grid's retained index runs; another topology is not this island bake. */
export function clipGridTerrain(mesh: THREE.Mesh, ISLAND_TERRAIN_CLIP: IslandTerrainClip): void {
  const geometry = mesh.geometry, source = geometry.getIndex();
  if (source === null || source.count !== ISLAND_TERRAIN_CLIP.sourceIndices || geometry.getAttribute('position').count !== ISLAND_TERRAIN_CLIP.sourceVertices || ISLAND_TERRAIN_CLIP.ranges.length > 512) throw new Error('Baked island terrain topology differs; rebuild its declared clipping facts');
  const out = new Uint32Array(ISLAND_TERRAIN_CLIP.outputIndices); let offset = 0;
  for (let i = 0; i < 512; i++) { // At most two retained runs per authored grid row.
    const row = ISLAND_TERRAIN_CLIP.ranges[i]; if (row === undefined) break;
    out.set(source.array.subarray(row.start, row.start + row.count), offset); offset += row.count;
  }
  geometry.setIndex(new THREE.BufferAttribute(out, 1));
}

/** The live sun's share of a baked bounce: its luminance × intensity × its elevation over the bake's reference
 *  (`refSunY`, floored at 0.2), or null before the sky has a sun light. */
export function sunBounceLevel(sky: Sky, refSunY: number): number | null {
  const l = sky.csm.lights[0];
  if (!l) return null;
  const lum = l.intensity * (0.2126 * l.color.r + 0.7152 * l.color.g + 0.0722 * l.color.b);
  const elev = Math.max(0, sky.sunDir.y) / Math.max(0.2, refSunY);
  return lum * elev;
}
