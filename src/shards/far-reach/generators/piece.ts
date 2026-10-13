import { Scene, type InstancedMesh } from 'three';
import { bake, BakedPiece } from '@wildshard/sdk/bake';
import type { KindBakeOptions, KindCollider, PieceBake } from '@wildshard/sdk/bake/kinds';

/** The shard Sky Reach's scene bakes into (shard.config.ts's identity). */
export const SKY_IDENTITY = { slug: 'far-reach', name: 'Sky Reach' } as const;

/** A Sky world piece: a `BakedPiece` whose extra rows keep their type for the bake's readers (the client's tints, hulls, rigs). */
export class SkyPiece<R extends object = Record<never, never>> extends BakedPiece {
  readonly extras: R;
  constructor(name: string, kinds: readonly (readonly [string, InstancedMesh])[], colliders: readonly KindCollider[], options: KindBakeOptions, extras: R) {
    super(name, kinds, colliders, options, Object.fromEntries(Object.entries(extras)));
    this.extras = extras;
  }
}

/**
 * One piece through `bake(scene, identity)` on its own (the stale gate's reader): its GLB, kind and collider rows, then its
 * extra rows, in the order `data/<rows>.json` keeps them. The whole world bakes as one scene in `scene.ts`.
 */
export function bakeSkyPiece<R extends object>(piece: SkyPiece<R>): PieceBake & R {
  const scene = new Scene(); scene.add(piece);
  const part = bake(scene, SKY_IDENTITY).pieces[0];
  if (part === undefined) throw new Error(`${piece.name}: bake() returned no piece`);
  return { glb: part.glb, kinds: part.kinds, colliders: part.colliders, ...piece.extras };
}
