/**
 * How Pine Hollow loads its image-to-3D hero props for their models (E315 M2; PINE-HOLLOW-REMASTER PH-B3): TRELLIS.2
 * generations built by scripts/img2mesh/build_props.py into public/assets/models/pine-hollow-hero/ — `<id>/<id>.glb`
 * (LOD0), its `.phone.glb` (the boot's swap) and `<id>-lod1/<id>-lod1.glb` — PBR kept, filtered and prepared by the
 * shard's sky. The models (../models/standingStone.ts, waystone.ts, beaverDam.ts, canoe.ts, contractBoard.ts,
 * caveArch.ts) draw LOD0 near (with its shadow) and LOD1 past their own distance (no shadow: a few pixels there).
 */
import * as THREE from 'three';
import { loadLodPairInto, lodPairOf, vertexHull, type GlbPart } from '@wildshard/engine/models/glb';
import type { ModelContext, ModelPart } from '@wildshard/engine/models/model';
import { pineHeroUrl, type PineHeroId } from './heroFiles';

/**
 * the turn that brings each generation's front (the face the reference showed: the carved glyphs, the lantern's arm, the
 * board's notices, the arch's mouth) to local +Z — TRELLIS keeps the reference camera's side, but not always the same way
 * round (read off render_still.py turntables of every build). A placement adds it to its yaw.
 */
export const HERO_FRONT: Readonly<Record<PineHeroId, number>> = { 'stone-a': Math.PI, 'stone-b': 0, 'stone-c': 0, waystone: 0, 'beaver-dam': 0, canoe: 0, 'contract-board': 0, 'cave-arch': 0 };

const key = (id: PineHeroId): string => `pine-hollow/hero:${id}`;

/** Load one hero prop's LOD pair into this shard's context (once). */
export async function loadPineHero(ctx: ModelContext, id: PineHeroId): Promise<void> {
  await loadLodPairInto(ctx, key(id), pineHeroUrl(id), pineHeroUrl(`${id}-lod1`), (m) => {
    if (m instanceof THREE.MeshStandardMaterial) {
      for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = 4;
      m.envMapIntensity = 0.8;
    }
    ctx.sky.setupMaterial(m);
  });
}

/** a loaded prop's LOD0 (null: its file did not load) */
export function heroLod0(ctx: ModelContext, id: PineHeroId): GlbPart | null { return lodPairOf(ctx, key(id)).lod0; }
/** its LOD1 (null: its file did not load) */
export function heroLod1(ctx: ModelContext, id: PineHeroId): GlbPart | null { return lodPairOf(ctx, key(id)).lod1; }

/** LOD0's part: shadows on */
export function heroNear(ctx: ModelContext, id: PineHeroId): ModelPart[] {
  const l = heroLod0(ctx, id);
  return l ? [{ geometry: l.geometry, material: l.material, castShadow: true, receiveShadow: true }] : [];
}
/** LOD1's part (LOD0's when it has none): no shadow */
export function heroFar(ctx: ModelContext, id: PineHeroId): ModelPart[] {
  const l = heroLod1(ctx, id) ?? heroLod0(ctx, id);
  return l ? [{ geometry: l.geometry, material: l.material, castShadow: false, receiveShadow: true }] : [];
}

/** the collision hull: ≤ 180 of the coarse LOD's vertices, own space (memoized per prop) */
export function heroHull(ctx: ModelContext, id: PineHeroId): Float32Array | null {
  return ctx.once(`${key(id)}:hull`, () => { const l = heroLod1(ctx, id) ?? heroLod0(ctx, id); return l ? vertexHull(l.geometry, 180) : null; });
}
