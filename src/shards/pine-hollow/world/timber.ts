/**
 * The timber kit Pine Hollow's landmark models are finished with (E315 M2; moved from src/shards/pine-hollow/world/landmarks.ts): a
 * building's parts in its OWN frame, on the cabins' own kit and materials (src/engine/world/Cabin.ts `cabinMats`, `logGeo`,
 * `boxUV`, `finishParts`): one merged mesh per material, two position-only shadow proxies, no new programs. Its
 * colliders and deck floors are gathered in the same frame; `place` carries them to the placement.
 *
 * A finished timber tags its detail set (iron, cloth, chinking, glass: `userData.until` = the cabins' detail distance +
 * its pad) and its far set (end grain, bark, doors and their shadow proxy: twice that), which `place`'s single draw
 * drops with distance — the old PineLandmarks.update, as data.
 */
import * as THREE from 'three';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { cabinMats, type Mats, type MatKey } from './homestead';
import { finishParts } from '../models/logCabin';
import { TIMBER_GLASS } from '../data/timberDraws';

type V3 = THREE.Vector3;

/** a walkable deck rectangle: centre, turn, half extents, height (own space, or world once placed) */
export interface Floor { x: number; z: number; rot: number; hw: number; hd: number; y: number }

/** what a built timber knows besides its drawing: its colliders and floors (own space) and its named points */
export interface TimberFacts {
  readonly colliders: readonly ColliderDesc[];
  readonly floors: readonly Floor[];
  readonly anchors: Readonly<Record<string, V3>>;
}

export class Timber {
  readonly root = new THREE.Group();
  readonly detail: THREE.Object3D[] = [];
  readonly far: THREE.Object3D[] = [];
  private readonly glass: THREE.BufferGeometry[] = [];
  private readonly parts = new Map<MatKey, THREE.BufferGeometry[]>();

  private constructor(name: string, private readonly factsRow: TimberFacts) { this.root.name = name; }

  /**
   * Merge the parts per material, add the glass, and tag what drops with distance: the detail set within the cabins'
   * detail distance + `pad`, the far set within twice it (+ `pad`); the detail's shadows off on a tier without them.
   */
  finish(mats: Mats, pad: number): THREE.Group {
    finishParts(this.parts, mats, this.root, this.detail, this.far);
    const glass = this.glass[0];
    if (glass !== undefined) {
      const gm = Object.assign(new THREE.Mesh(glass, mats.glass), TIMBER_GLASS);
      this.root.add(gm); this.detail.push(gm);
    }
    if (!TIER_CONFIG.cabinDetailShadows) for (const o of this.detail) o.traverse((c) => { c.castShadow = false; });
    const dd = TIER_CONFIG.cabinDetailDist;
    for (const o of this.detail) o.userData['until'] = dd + pad;
    for (const o of this.far) o.userData['until'] = dd * 2 + pad;
    return this.root;
  }
  facts(): TimberFacts { return this.factsRow; }
  /** a timber from its offline bake: its parts, glass and facts as the builder left them, ready to `finish` */
  static baked(name: string, parts: ReadonlyMap<MatKey, THREE.BufferGeometry[]>, glass: readonly THREE.BufferGeometry[], facts: TimberFacts): Timber {
    if (glass.length > 1) throw new Error('[timber] authored glass must be one original draw');
    const t = new Timber(name, facts);
    for (const [key, list] of parts) t.parts.set(key, list);
    t.glass.push(...glass);
    return t;
  }
}

const MATS = 'pine-hollow/timber:mats';

/** Load the timber's materials (the cabins') into this shard's context. */
export async function loadTimber(ctx: ModelContext): Promise<void> {
  const mats = await cabinMats(ctx.sky);
  ctx.once(MATS, () => mats);
}

export const timberMats = (ctx: ModelContext): Mats => ctx.once<Mats>(MATS, () => { throw new Error('[timber] loadTimber(ctx) first'); });

/**
 * A timber model's build and its facts, keyed by the copy's params (one build per copy: `place` builds, then asks for
 * the colliders with the same params; the world then asks for the floors and anchors). `make` builds and finishes it;
 * `keyOf` picks what identifies a copy (a site-fitted one: its ground function — `place` merges the params into a new
 * object).
 */
export function timberFacts<P extends object>(make: (ctx: ModelContext, p: P) => Timber, keyOf: (p: P) => object = (p) => p): { build: (ctx: ModelContext, p: P) => THREE.Group; facts: (ctx: ModelContext, p: P) => TimberFacts } {
  const known = new WeakMap<object, TimberFacts>();
  return {
    build: (ctx, p) => { const t = make(ctx, p); if (!known.has(keyOf(p))) known.set(keyOf(p), t.facts()); return t.root; },
    facts: (ctx, p) => { let f = known.get(keyOf(p)); if (f === undefined) { f = make(ctx, p).facts(); known.set(keyOf(p), f); } return f; },
  };
}
