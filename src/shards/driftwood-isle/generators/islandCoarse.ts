import * as THREE from 'three';
import { bakePlacementPose as poseOf } from '@wildshard/sdk/bake/colliders';
import type { AuthorPlacement as Placement } from '@wildshard/sdk/bake/placement';
import type { PalmParams } from './foliageModels';
import { PALM_PALETTE, palmAxisAt } from './palm';
import { SHORE_ROCK } from './rockProfiles';
import type { ShoreParams } from './rockScenes';
import { inArea } from './blenderArea';

type V = readonly [number, number, number];
interface Placed<P> { readonly x: number; readonly y: number; readonly z: number; readonly params: P }

/** fronds a far palm keeps (its near model has 2 x `fronds`, 9-13 of them a layer) */
const FAR_FRONDS = 4;
/** a far frond's length and half width at its middle (the near skirt fronds run 3.2-4.3 m) */
const FROND_LENGTH = 3.6, FROND_HALF_WIDTH = 0.5;
const ROCK = { light: new THREE.Color(SHORE_ROCK.light), mid: new THREE.Color(SHORE_ROCK.mid) };

/**
 * D200 (Jake G832): the island dressing's far stand-ins, world space, for Driftwood's coarse L1 tiles. Beyond the render
 * ring the merged palms and shore boulders drew nothing (their meshes draw only the resident tiles' triangles), so the
 * meadows and shores went bare past ~150 m and filled in as the player came closer. Each placement gets a silhouette in its
 * own colours: a palm its trunk on the real lean and a crown of drooping fronds, a boulder a squat lump on its pose.
 * Palms inside the Blender cove are left out, as the near merged palms leave them (the cove places its own). The hibiscus
 * bushes (~5 px at 150 m on the phone) are not stood in: the parents' 0.2 MB cap goes to the palms. Flat-shaded,
 * non-indexed, position / normal / color.
 */
export function islandCoarse(palms: readonly Placed<PalmParams>[], boulders: readonly Placement<ShoreParams>[]): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const tri = (a: V, b: V, c: V, color: THREE.Color): void => { for (const v of [a, b, c]) { pos.push(...v); col.push(color.r, color.g, color.b); } };
  const both = (a: V, b: V, c: V, color: THREE.Color): void => { tri(a, b, c, color); tri(a, c, b, color); };

  for (const palm of palms) {
    if (inArea(palm.x, palm.z, 1)) continue;
    const p = palm.params, at = (v: THREE.Vector3): V => [palm.x + v.x, palm.y + v.y, palm.z + v.z];
    // the trunk: three sides foot to crown, thinner at the top
    const [foot, crown] = [0, 1].map(t => {
      const c = palmAxisAt(p, t), r = 0.3 * (1 - t * 0.45);
      return [0, 1, 2].map(k => { const a = (k / 3) * Math.PI * 2 + p.rot; return at(new THREE.Vector3(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r)); });
    });
    for (let k = 0; k < 3; k++) {
      const a = foot?.[k], b = foot?.[(k + 1) % 3], c = crown?.[(k + 1) % 3], d = crown?.[k];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      tri(a, b, c, PALM_PALETTE.trunk); tri(a, c, d, PALM_PALETTE.trunk);
    }
    // the crown: fronds radiating from the top and drooping (the near skirt's spine at a mid tilt), seen from both sides
    const top = palmAxisAt(p, 1);
    const spine = (t: number): number => 0.9 * Math.sin(t * Math.PI * 0.55) - 1.62 * t * t + 0.15;
    for (let f = 0; f < FAR_FRONDS; f++) {
      const ang = (f / FAR_FRONDS) * Math.PI * 2 + p.rot, dx = Math.cos(ang), dz = Math.sin(ang), sx = -dz, sz = dx;
      const point = (t: number, side: number): V => at(new THREE.Vector3(top.x + dx * FROND_LENGTH * t + sx * side, top.y + spine(t), top.z + dz * FROND_LENGTH * t + sz * side));
      const root = point(0, 0), left = point(0.5, -FROND_HALF_WIDTH), right = point(0.5, FROND_HALF_WIDTH), tip = point(1, 0);
      const colour = f % 2 === 0 ? PALM_PALETTE.frond : PALM_PALETTE.frondDark;
      both(root, left, right, colour); both(left, tip, right, colour);
    }
  }

  const v = new THREE.Vector3();
  for (const boulder of boulders) {
    const r = boulder.params?.r ?? 1, h = r * (boulder.params?.squash ?? 0.7), matrix = poseOf(boulder).matrix;
    // a squat six-sided lump on the boulder's own pose (its waist at the sand: no underside)
    const local = (x: number, y: number, z: number): V => { v.set(x, y, z).applyMatrix4(matrix); return [v.x, v.y, v.z]; };
    const waist = Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2; return local(Math.cos(a) * r, -h * 0.2, Math.sin(a) * r); });
    const top = local(0, h, 0);
    for (let k = 0; k < 6; k++) {
      const a = waist[k], b = waist[(k + 1) % 6];
      if (a === undefined || b === undefined) continue;
      tri(a, top, b, k % 2 === 0 ? ROCK.light : ROCK.mid);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  return geometry;
}
