/**
 * The sailboat's two mooring lines, baked offline (SHARD-PLATFORM W2): the pier's post choice (the bollard by the bow,
 * else the piling nearest it; the piling nearest the stern) re-run on the south pier's measured params, then each line a
 * sagging tube from the boat's cleat at rest to its post, in world space, flat vertex-coloured for the low-poly kit.
 * Every vertex carries `aMoor` (how far it lifts with the bow cleat, how far with the stern cleat: 1 at its cleat, 0 at
 * its post), so the world's Boat lifts the cleat ends with the hull's heave and pitch while the post ends stay tied.
 * The world draws it as the fixed-model template `mooring-lines`.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PierParams, PierSpec } from '../assets/contracts/pier';
import { BOAT_LAYOUT } from './boatLayout';
import { BOAT_CLEATS } from './boatFrame';
import { pierPosts } from '../world/pierLayout';
import { LOWERED_SEA } from '../world/sea';
import { BOAT_MOOR } from '../world/sites';

interface XZ { x: number; z: number }

/** Hemp-coloured lines tied 1.9 m over the still water, sagging 35 cm: 8-segment tubes 3 cm thick, 4 sides. */
const BOAT_MOORING = { color: '#d2bd85', postAbove: 1.9, sag: 0.35, segments: 8, radius: 0.03, radial: 4 };

/** [bow post, stern piling] on the boat's side of the pier (the original Pier.mooringsFor). */
function moorings(spec: PierSpec, params: PierParams, x: number, z: number): [XZ, XZ] {
  const yaw = spec.rot ?? 0, cos = Math.cos(yaw), sin = Math.sin(yaw), sternZ = z + 3, bowZ = z - 3;
  const toWorld = ([along, across]: [number, number]): XZ => ({ x: spec.x + across * cos + along * sin, z: spec.z - across * sin + along * cos });
  const laid = pierPosts(params), posts = laid.posts.map(toWorld), bollards = laid.bollards.map(toWorld);
  const side = (x - spec.x) * cos - (z - spec.z) * sin < 0 ? -1 : 1;
  const onSide = (p: XZ): boolean => Math.sign((p.x - spec.x) * cos - (p.z - spec.z) * sin) === side;
  const nearest = (at: number): XZ | undefined => {
    let pick: XZ | undefined, best = Infinity;
    for (const p of posts) { if (!onSide(p)) continue; const d = Math.hypot(p.x - x, p.z - at); if (d < best) { best = d; pick = p; } }
    return pick;
  };
  const bollard = bollards.find(onSide) ?? bollards[0], post = nearest(sternZ);
  const bow = bollard !== undefined && Math.hypot(bollard.x - x, bollard.z - bowZ) < 6 ? bollard : nearest(bowZ) ?? bollard;
  if (bow === undefined || post === undefined) throw new Error('mooringLines: the south pier has no posts');
  return [bow, post];
}

/** The boat's lines at rest, world space, `aMoor` = (bow-cleat weight, stern-cleat weight) per vertex. */
export function mooringLinesGeometry(spec: PierSpec, params: PierParams): THREE.BufferGeometry {
  const row = BOAT_MOORING, color = new THREE.Color(row.color), waterY = LOWERED_SEA, heading = 0;
  const cs = Math.cos(heading), sn = Math.sin(heading);
  const cleat = (lz: number, ly: number): THREE.Vector3 => new THREE.Vector3(BOAT_MOOR.x + lz * sn, waterY + ly, BOAT_MOOR.z + lz * cs);
  const length = BOAT_LAYOUT.length, cleats = [cleat(-length / 2 + 0.3, BOAT_CLEATS[0]?.y ?? 0.7), cleat(length / 2 - 0.3, BOAT_CLEATS[1]?.y ?? 0.7)];
  const posts = moorings(spec, params, BOAT_MOOR.x, BOAT_MOOR.z);
  const parts = posts.map((post, i) => {
    const a = cleats[i];
    if (a === undefined) throw new Error('mooringLines: a line without its cleat');
    const b = new THREE.Vector3(post.x, waterY + row.postAbove, post.z);
    const mid = a.clone().lerp(b, 0.5); mid.y -= row.sag;
    const g = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), row.segments, row.radius, row.radial, false);
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const ni = g.toNonIndexed(), p = ni.getAttribute('position'), n = p.count, c = new Float32Array(n * 3), m = new Float32Array(n * 2);
    const dx = post.x - a.x, dz = post.z - a.z, len2 = dx * dx + dz * dz || 1;
    for (let k = 0; k < n; k++) {
      c[k * 3] = color.r; c[k * 3 + 1] = color.g; c[k * 3 + 2] = color.b;
      const t = Math.min(1, Math.max(0, ((p.getX(k) - a.x) * dx + (p.getZ(k) - a.z) * dz) / len2));
      m[k * 2 + i] = 1 - t;
    }
    ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
    ni.setAttribute('aMoor', new THREE.BufferAttribute(m, 2));
    return ni;
  });
  return mergeGeometries(parts, false);
}
