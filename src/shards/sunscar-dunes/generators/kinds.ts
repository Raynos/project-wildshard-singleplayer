import { Scene, type InstancedMesh, type MeshStandardMaterial, type Object3D } from 'three';
import { foldKinds as foldSdkKinds, type KindExtra, type PieceBake } from '@wildshard/sdk/bake/kinds';
import { bake, BakedPiece, type BakedSceneParts } from '@wildshard/sdk/bake';

/**
 * Build-time only (SHARD-PLATFORM SF72): Signal Dunes' use of the SDK's instanced-kinds baker (`@wildshard/sdk/bake/kinds`).
 * A piece's GLB is named `sunscar.<piece>`, and a kind whose material a builder marked `userData.warm` (lit by the fires,
 * `world/meshes.ts` warmByFire) keeps `warm: true` in its row, which the client reads back (`world/baked.ts`); a waymark's
 * own kind keeps its `brazier` index (`userData.brazier`), so the client lights one waymark's logs alone.
 */
const warm = (material: MeshStandardMaterial): KindExtra => {
  const brazier: unknown = material.userData['brazier'];
  return { ...(material.userData['warm'] === true ? { warm: true } : {}), ...(typeof brazier === 'number' ? { brazier } : {}) };
};

/** The surfaces Signal's colliders name (a subset of the physics registry's materials). */
export type SignalSurface = 'rock' | 'stone' | 'wood' | 'metal' | 'felt' | 'flesh';
/** A box collider row as the physics registry reads it (centre, half-extents, yaw about +Y, surface), JSON key order fixed. */
export interface SignalBox { readonly kind: 'box'; readonly x: number; readonly y: number; readonly z: number; readonly hx: number; readonly hy: number; readonly hz: number; readonly yaw?: number; readonly surface?: SignalSurface }
/** Signal's collider rows: boxes only. */
export type ColliderDesc = SignalBox;

/**
 * A box from a footprint (`hw` × `hd` half-extents turned by `rot`) between two heights: the physics registry's own
 * `boxDesc` row (centre midway, `hy` at least 5 mm, `yaw = -rot`), authored here so the bake reads no engine module (G320).
 */
export function boxDesc(c: { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }, surface?: SignalSurface): SignalBox {
  return { kind: 'box', x: c.x, y: (c.yTop + c.yBottom) / 2, z: c.z, hx: c.hw, hy: Math.max(0.005, (c.yTop - c.yBottom) / 2), hz: c.hd, yaw: -c.rot, ...(surface === undefined ? {} : { surface }) };
}

/** One Signal piece as a scene node (`@wildshard/sdk/bake`): its instanced kinds baked into `sunscar.<piece>`, its colliders and rows. */
export const signalPiece = (piece: string, meshes: readonly (readonly [string, InstancedMesh])[], colliders: readonly ColliderDesc[], rows: Readonly<Record<string, unknown>> = {}): BakedPiece<ColliderDesc> =>
  new BakedPiece(`sunscar.${piece}`, meshes, colliders, { extra: warm }, rows);

/** A baked piece as its `data/<piece>.json` keeps it (beside the GLB's hash): kinds, colliders, then the piece's own rows. */
export type SignalPieceBake = PieceBake & Readonly<Record<string, unknown>>;
export const pieceRows = (p: BakedSceneParts): SignalPieceBake => ({ glb: p.glb, kinds: p.kinds, colliders: p.colliders, ...p.rows });

/** One piece through `bake` alone: the stale gates' per-piece view of the whole scene's bake (`generators/scene.ts`). */
export function bakePiece(piece: BakedPiece<ColliderDesc>): SignalPieceBake {
  const out = bake(new Scene().add(piece), { slug: 'sunscar-dunes' }).pieces[0];
  if (out === undefined) throw new Error(`${piece.name} baked nothing`);
  return pieceRows(out);
}

/** A built group folded into instanced kinds, a `warm` material its own kind. */
export const foldKinds = (root: Object3D): (readonly [string, InstancedMesh])[] => foldSdkKinds(root, { extra: warm });
