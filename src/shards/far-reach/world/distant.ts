import { DoubleSide, Group, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Isle } from '../data/layout';
import { SKY_ISLES, type SkyIsle } from '../data/skyIsles';
import { FALLS, FALL_SHADER } from '../data/falls';
import { skyBakedGeometry } from './baked';

/** The falls' clock (the plugin advances it): the streaks run down the sheet. */
export const FALL_TIME = { value: 0 };
/**
 * Falling water, not a white card (council round 2): streaks of foam scrolling down, soft thin edges, a blue-white body
 * that frays into spray toward the bottom; brighter where the low sun backlights it. Local frame: x −0.5..0.5 across the
 * sheet, y 0 at the lip down to −1 (the instance scales it to its width and length).
 */
function fallMaterial(): ShaderMaterial {
  return new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, fog: false, uniforms: { uTime: FALL_TIME }, ...FALL_SHADER });
}

/**
 * The falls, one instanced draw: each sheet hangs from its isle's lip, facing out. `lip` gives a modelled isle's rim
 * radius at an angle (world/skyIsleHd.ts; null: the code isle's 12-gon), and the sheet hangs just inside it, under the turf.
 * `skyIsles`: the decorative isles that stand (all standalone; inside the cube in a grid cell, G99).
 */
export function skyline(isles: readonly Isle[], lip: (isle: Isle, a: number) => number | null = () => null, skyIsles: readonly SkyIsle[] = SKY_ISLES): Group {
  const group = new Group(), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  const sky = skyIsles.flatMap((s) => s.fall === null ? [] : [{ isle: s, a: s.fall, length: s.keel * 1.3 }]);
  const at = [...FALLS.flatMap(([id, a, length]) => { const isle = isles.find((i) => i.id === id); return isle === undefined ? [] : [{ isle, a, length }]; }), ...sky];
  // the sheet's geometry is baked (generators/geometries.ts `fall`, 1 m by 1 m): each instance scales it
  const fall = skyBakedGeometry('fall'), falls = new InstancedMesh(fall, fallMaterial(), at.length);
  at.forEach(({ isle, a, length }, k) => {
    const r = (lip(isle, a) ?? isle.r * Math.cos(Math.PI / 12)) * 0.9, width = 1.8 + isle.r * 0.04;
    q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a)));
    m.compose(new Vector3(isle.x + Math.cos(a) * r, isle.y - 1.1, isle.z + Math.sin(a) * r), q, new Vector3(width, length, 1)); falls.setMatrixAt(k, m);
  });
  falls.computeBoundingSphere(); group.add(falls);
  return group;
}
