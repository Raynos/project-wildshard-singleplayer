/** Authoring-only cabin shapes and plain records. No page services, schemas or trusted controller imports. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Boards across the original PBR texture, and its size along the grain. */
export const BOARDS = 7, BOARD_LEN = 1.25;
/** The original per-part material identities. */
export type KitMat = 'log' | 'endGrain' | 'chink' | 'roof' | 'beam' | 'deck' | 'door' | 'stone' | 'bark' | 'iron' | 'cloth' | 'char';
/** A world-space turned rectangle from the original building recipe. */
export interface Collider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
/** A native room rectangle. */
export interface Room { x: number; z: number; hw: number; hd: number }
/** A native floor rectangle, kept in world space. */
export interface Floor extends Room { rot: number; y: number }
/** Original light classification. */
export type LightKind = 'fire' | 'lamp';
/** The four native prop references. */
export type PropKind = 'crate' | 'barrel' | 'bucket' | 'hatchet';
/** Original captured prop model extents; hatchet keeps its host chopping-block owner. */
export const PROP_BOXES: Readonly<Record<PropKind, { readonly hw: number; readonly hd: number; readonly h: number } | null>> = {
  crate: { hw: 0.265, hd: 0.583, h: 0.455 }, barrel: { hw: 0.34, hd: 0.34, h: 0.872 }, bucket: { hw: 0.17, hd: 0.17, h: 0.35 }, hatchet: null,
};
type XYZ = [number, number, number];
interface BoxRow { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; yaw?: number; surface?: 'stone' | 'wood' }
/** A native light record, without a live light object. */
export interface BakedLight { color: number; intensity: number; distance: number; decay: number; at: XYZ; seed: number; kind: LightKind; rank: number }
/** Native moving/decorative members in original append order. */
export type BakedNode =
  | { t: 'door'; pivot: XYZ; leaf: number; iron: number; batten: number; id: string; collider: number; top: number; use: XYZ; slab: BoxRow }
  | { t: 'glow'; g: number; at: XYZ; yaw: number }
  | { t: 'pit'; at: XYZ; yaw: number }
  | { t: 'particles'; mat: 'flame' | 'ember' | 'smoke'; seeds: number; at: XYZ; order: number; detail: boolean }
  | { t: 'lantern'; pivot: XYZ; ring: number; light: BakedLight; swing: number }
  | { t: 'wheel'; g: number; at: XYZ; yaw: number }
  | { t: 'light'; light: BakedLight };
/** Native shape byte layout, retained for frozen binary equality. */
export interface BakedGeometry { attrs: [string, number][]; count: number; unique: number; own: 'u16' | 'u32' | null; indexCount: number }
/** Original per-building placement and owner records, with no constructor-valued fields. */
export interface BakedBuilding {
  id: string; index: number; hamlet: boolean; at: XYZ; rot: number; size: [number, number]; parts: [KitMat, number][];
  glass: number[]; nodes: BakedNode[]; colliders: Collider[]; solids: { d: BoxRow; prop: boolean }[];
  floors: Floor[]; rooms: Room[]; doorAt: [number, number]; props: Record<PropKind, number[][]>; firePit: XYZ | null;
}
/** Immutable cabin records beside their original byte stream. */
export interface CabinRows { bin: string; bytes: number; geometries: BakedGeometry[]; buildings: BakedBuilding[]; hamlet: { at: XYZ; pad: number } | null }

/** planar UVs by dominant face normal, in the geometry's current space, metres / scale */
export function boxUV<G extends THREE.BufferGeometry>(geo: G, scale: number, uOff = 0, vOff = 0): G {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let pu: number, pv: number;
    if (ny >= nx && ny >= nz) { pu = pos.getX(i); pv = pos.getZ(i); }
    else if (nx >= nz) { pu = pos.getZ(i); pv = pos.getY(i); }
    else { pu = pos.getX(i); pv = pos.getY(i); }
    uv.setXY(i, pu / scale + uOff, pv / scale + vOff);
  }
  return geo;
}
/** Swap original texture axes, in place. */
export function swapUV<G extends THREE.BufferGeometry>(geo: G): G {
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geo;
}

/** a horizontal log along +X of `len`, radius r, textured with one board of the log-wall set (or bark when `bark`) */
export function logGeo(len: number, r: number, board: number, vOff: number, segs = 14, bark = false): { side: THREE.CylinderGeometry; caps: THREE.BufferGeometry } {
  const side = new THREE.CylinderGeometry(r, r, len, segs, 1, true);
  const pos = side.getAttribute('position'), uv = side.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const th = Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 0.5; // 0..1 around
    if (bark) uv.setXY(i, th * (r * 6.283) * 0.5, (pos.getY(i) + vOff) * 0.5); // pine_bark is a 2 m tile
    else {
      const tri = th < 0.5 ? th * 2 : 2 - th * 2;                              // mirror so the board wraps front & back
      uv.setXY(i, (board + 0.06 + tri * 0.88) / BOARDS, (pos.getY(i) + vOff) / BOARD_LEN);
    }
  }
  side.rotateZ(-Math.PI / 2); // +Y → +X
  const capA = new THREE.CircleGeometry(r, segs).rotateY(Math.PI / 2).translate(len / 2, 0, 0);
  const capB = new THREE.CircleGeometry(r, segs).rotateY(-Math.PI / 2).translate(-len / 2, 0, 0);
  return { side, caps: mergeGeometries([capA, capB]) };
}
