/**
 * The timber kit Pine Hollow's landmark models are drawn with (E315 M2; SHARD-PLATFORM W2, the game's library models
 * `@wildshard/game/models/libraryModel`): a copy's draws are its offline bake's rows (one whole geometry per material,
 * `<copy>-<key>`, then its glass, read through ./timberSites.ts), on the cabins' own materials (./homestead.ts
 * `cabinMats`), merged by the engine's weld unit: one mesh per material, two position-only shadow proxies, no new
 * programs. Its colliders are the bake's rows; its deck floors are the landmarks' (world space, ../data rows).
 *
 * The detail set (iron, cloth, chinking, char, glass) is drawn within the cabins' detail distance + the copy's pad, and
 * casts no shadow on a tier without detail shadows; the far set (end grain, bark, doors and their shadow proxy) within
 * twice it (+ the pad). `place`'s single draw drops each with distance (`userData.until`).
 */
import type * as THREE from 'three';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { libraryModel, type LibraryDraw } from '@wildshard/game/models/libraryModel';
import { cabinMats, type Mats, type MatKey } from './homestead';
import { TIMBER_DRAWS, TIMBER_GLASS } from '../data/timberDraws';
import type { TimberRow } from './timberBake';
import { timberDraw } from './timberSites';

/** a walkable deck rectangle: centre, turn, half extents, height (own space, or world once placed) */
export interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }

/** a timber copy: its draws' library prefix and its bake's rows */
export interface TimberCopy { readonly identity: string; readonly row: TimberRow }

const MATS = 'pine-hollow/timber:mats', DETAIL = 1, FAR = 2;

/** Load the timber's materials (the cabins') into this shard's context. */
export async function loadTimber(ctx: ModelContext): Promise<void> {
  const mats = await cabinMats(ctx.sky);
  ctx.once(MATS, () => mats);
}

export const timberMats = (ctx: ModelContext): Mats => ctx.once<Mats>(MATS, () => { throw new Error('[timber] loadTimber(ctx) first'); });

/** a copy's draws: a library geometry per material its bake drew, then its glass (a detail draw of its own) */
function draws({ identity, row }: TimberCopy): LibraryDraw<MatKey | 'glass'>[] {
  const parts: LibraryDraw<MatKey | 'glass'>[] = [];
  for (const { key, counts } of row.parts) if (counts.length > 0) parts.push({ ...TIMBER_DRAWS[key], draw: `${identity}-${key}`, material: key });
  if (row.glass.length > 0) parts.push({ ...TIMBER_GLASS, until: DETAIL, draw: `${identity}-glass`, material: 'glass' });
  return parts;
}

/** A timber model's build and colliders: the copy its params name, its bands padded by `pad` metres (its size). */
export function timberModel<P extends object>(copy: (params: P) => TimberCopy, pad: number): Pick<ModelDef<P>, 'build' | 'colliders'> {
  const band = (mesh: THREE.Object3D, until: number | undefined): void => {
    const dd = TIER_CONFIG.cabinDetailDist;
    if (until === DETAIL) { mesh.userData['until'] = dd + pad; if (!TIER_CONFIG.cabinDetailShadows) mesh.castShadow = false; }
    else if (until === FAR) mesh.userData['until'] = dd * 2 + pad;
  };
  return libraryModel<P, MatKey | 'glass'>({
    draws: (params) => draws(copy(params)),
    geometry: timberDraw,
    material: (ctx, key) => timberMats(ctx)[key],
    colliders: (params) => structuredClone(copy(params).row.colliders),
    finish: ({ meshes, proxies }) => {
      for (const { mesh, part } of meshes) band(mesh, part.until);
      for (const { mesh, until } of proxies) if (until === FAR) band(mesh, until);
    },
  });
}
