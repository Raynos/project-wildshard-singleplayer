/** Pine-owned plain author facts. No registry, renderer services or live model constructors are loaded. */
import type { Vector3 } from 'three';
import type { Floor, KitMat } from './cabinShapes';

/** Pine's declared seed, retained by both original landmark recipes. */
export const PINE_TIMBER_SEED = 1337;
/** Native retained lookout identity. */
export const LOOKOUT_SEED = 901;
/** Original non-indexed attribute block order. */
export const TIMBER_ATTRS = [['position', 3], ['normal', 3], ['uv', 2]] as const;
interface Point { x: number; y: number; z: number }
/** Exact native boxes and riser records; the runtime remains their only physics owner. */
export type ColliderRow =
  | { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw?: number; rot?: Point & { w: number }; surface?: 'wood' | 'stone' }
  | { kind: 'treads'; from: Point; to: Point; width: number; count: number; surface?: 'wood' | 'stone' };
/** Facts collected from the original builder before finishing its view. */
export interface TimberFacts { readonly colliders: readonly ColliderRow[]; readonly floors: readonly Floor[]; readonly anchors: Readonly<Record<string, Vector3>> }
/** Exact recorded material blocks and independent gameplay facts. */
export interface TimberRow { parts: { key: KitMat; counts: number[] }[]; glass: number[]; colliders: ColliderRow[]; floors: Floor[]; anchors: Record<string, [number, number, number]> }
/** Native lookout records beside the retained binary oracle. */
export interface LookoutRows extends TimberRow { bin: string; bytes: number; seed: number }
/** Native site and turntable copies, in their original byte order. */
export interface SiteTimberRows { bin: string; bytes: number; seed: number; landing: { world: TimberRow; turntable: TimberRow }; bridge: { world: TimberRow; turntable: TimberRow } }
