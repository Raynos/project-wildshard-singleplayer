import type { InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { bakeKinds as bakeSdkKinds, foldKinds as foldSdkKinds, type KindExtra, type PieceBake } from '@wildshard/sdk/bake/kinds';

/**
 * Build-time only (SHARD-PLATFORM SF72): Signal Dunes' use of the SDK's instanced-kinds baker (`@wildshard/sdk/bake/kinds`).
 * A piece's GLB is named `sunscar.<piece>`, and a kind whose material a builder marked `userData.warm` (lit by the fires,
 * `world/meshes.ts` warmByFire) keeps `warm: true` in its row, which the client reads back (`world/baked.ts`).
 */
const warm = (material: MeshStandardMaterial): KindExtra => material.userData['warm'] === true ? { warm: true } : {};

/** One Signal piece baked: its instanced kinds into `sunscar.<piece>`, its rows and colliders. */
export const bakeKinds = (piece: string, meshes: readonly (readonly [string, InstancedMesh])[], colliders: readonly ColliderDesc[]): PieceBake =>
  bakeSdkKinds(`sunscar.${piece}`, meshes, colliders, { extra: warm });

/** A built group folded into instanced kinds, a `warm` material its own kind. */
export const foldKinds = (root: Object3D): (readonly [string, InstancedMesh])[] => foldSdkKinds(root, { extra: warm });
