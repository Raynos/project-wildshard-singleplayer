import * as THREE from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { readRigRest } from '@wildshard/sdk/bake/rig';
import { buildPrimitive, mergePrimitives } from '@wildshard/sdk/kit/mergedPrimitives';
import { KING_DRESS } from '../data/antlerKingLook';

/**
 * The Antler King's kit, baked (SHARD-PLATFORM, sp-o208): the antler lantern (its iron frame and amber glass), the amber
 * ribcage and its burning core, built once here from KING_DRESS's primitive rows and written as one rest-geometry pool
 * the page borrows (models/antlerKing.ts); and where his three lanterns hang on his hull (the same on both tiers): the rack's outermost
 * left and right points and the right beam's middle, read off the rigged hull's bind pose (KING_DRESS.rack). The page
 * builds none of it and reads no hull vertex.
 */

type V3 = [number, number, number];

/** The hull's lantern spots in the rack bone's frame: [left, right, middle] (as the page once picked them off the hull). */
function rackSpots(geometry: THREE.BufferGeometry, bones: readonly { readonly name: string; readonly pos: readonly number[] }[]): V3[] {
  const row = KING_DRESS.rack, bone = bones.find((b) => b.name === row.bone);
  if (bone === undefined) throw new Error(`King kit: the hull has no ${row.bone} bone`);
  const [hx = 0, hy = 0, hz = 0] = bone.pos, P = geometry.getAttribute('position');
  const above = (i: number): boolean => P.getY(i) > hy + row.above && Math.abs(P.getZ(i) - hz) < row.reachZ;
  let left = -1, right = -1, mid = -1, lx = Infinity, rx = -Infinity, best = -Infinity;
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    const x = P.getX(i);
    if (x < lx) { lx = x; left = i; }
    if (x > rx) { rx = x; right = i; }
  }
  for (let i = 0; i < P.count; i++) {
    if (!above(i)) continue;
    if (Math.abs(P.getX(i) - rx * row.middle.frac) < Math.abs(rx) * row.middle.tol && P.getY(i) > best) { best = P.getY(i); mid = i; }
  }
  if (left < 0 || right < 0 || mid < 0) throw new Error('King kit: the hull has no rack above its head');
  const at = (i: number): V3 => [P.getX(i) - hx, P.getY(i) - hy - row.drop, P.getZ(i) - hz];
  return [at(left), at(right), at(mid)];
}

/** The kit as one rest-geometry pool GLB, and the rows the page reads it by (the lantern spots). */
export async function bakeKingKit(readRig: (tier: 'phone' | 'desktop') => Uint8Array): Promise<{ glb: Uint8Array; rows: { pool: { url: string; parts: string[] }; lanterns: V3[] } }> {
  const D = KING_DRESS;
  const parts: [string, THREE.BufferGeometry][] = [
    ['king-lantern-frame', mergePrimitives(D.frame)], ['king-lantern-glass', buildPrimitive(D.glass)],
    ['king-ribs', mergePrimitives(D.ribs)], ['king-core', buildPrimitive(D.core)],
  ];
  // both tiers' hulls carry the same rack tips (refused here if they ever differ), so the page needs no tier
  const [phone, desktop] = await Promise.all((['phone', 'desktop'] as const).map(async (tier) => { const rest = await readRigRest(readRig(tier)); return rackSpots(rest.geometry, rest.bones); }));
  const lanterns = desktop ?? [];
  if (JSON.stringify(phone) !== JSON.stringify(lanterns)) throw new Error('King kit: the phone and desktop hulls hang the lanterns differently');
  const neutral = new THREE.MeshStandardMaterial();
  const glb = staticGlb(parts.map(([name, geometry]) => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const box = geometry.boundingBox, sphere = geometry.boundingSphere;
    return { name, geometry, material: neutral, compactIndex: true as const, extras: {
      restGroups: [],
      restBox: box === null ? null : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z],
      restSphere: sphere === null ? null : [sphere.center.x, sphere.center.y, sphere.center.z, sphere.radius],
    } };
  }), 'pine-king-kit');
  return { glb, rows: { pool: { url: '/assets/pine-hollow/baked/king-kit.glb', parts: parts.map(([name]) => name) }, lanterns } };
}
