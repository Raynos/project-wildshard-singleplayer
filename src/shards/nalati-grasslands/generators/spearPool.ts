import ARM_STYLE from '../data/armsStyle.json' with { type: 'json' };
import { MeshBasicMaterial, Vector3, type BufferGeometry } from 'three';
import { staticGlb, type GlbPrimitive } from '@wildshard/sdk/bake/glb';
import { bakeGloveFist, bakeRiderArm } from '@wildshard/sdk/bake/riderArms';
import { installPortableMath } from '@wildshard/commons/bake/portableMath';
import { merge } from './meleeGeo';
import { buildSpear, buildJavelin, SPEAR_PROFILE, SPEAR_VIEW } from './spear';

/** The spear's rest pool's product name: the held polearm reads it through `product.url` (GR6; it was a hashed public
 *  GLB). */
export const SPEAR_POOL_NAME = 'models/held/spear.glb';

/** The polearm page rows (`weapons/spear.json` before its program and presentation join it). */
export interface SpearPoolRows {
  pool: { url: string; parts: string[] };
  profile: Record<string, unknown>;
  view: { poses: Record<string, { pos: number[]; q: number[] }>; elbows: { left: number[]; right: number[] }; javelinGrip: unknown; tapMax: number;
    wrists: { left: number[]; right: number[] } };
}

/**
 * GR6: Nalati's spear and javelin at build time (the retired nalati-spear-pool job's bytes): the spear, javelin, held
 * spear, fists and arms as one rest pool GLB, and the polearm page rows. Content-addressed geometry must use the same
 * transcendental bits on arm64 and x64, so the builders run with portable Math installed, as the retired bake did. The
 * spear module itself is imported statically (the author bundle is one module); its own constants evaluate to the same
 * pool bytes under native Math.
 */
export function nalatiSpearPool(): { glb: Uint8Array; rows: SpearPoolRows } {
  const restore = installPortableMath();
  try {
    const spear = buildSpear(), javelin = buildJavelin(), { hands, leftHandY } = SPEAR_VIEW;
    const restInv = SPEAR_VIEW.poses.rest.q.clone().invert();
    const fist = (direction: readonly [number, number, number], mirror: boolean): ReturnType<typeof bakeGloveFist> => {
      const d = new Vector3(...direction).normalize().applyQuaternion(restInv);
      return bakeGloveFist(ARM_STYLE, { R: hands.radius, mirror, yaw: Math.atan2(d.x, d.z) - Math.atan2(mirror ? -hands.splay : hands.splay, 1) });
    };
    const left = fist(hands.left, true), right = fist(hands.right, false);
    const parts: [string, BufferGeometry][] = [
      ['spear-paint', spear.paint], ['spear-metal', spear.metal],
      ['javelin-paint', javelin.paint], ['javelin-metal', javelin.metal],
      ['held-spear', merge([spear.paint.clone(), left.geometry.clone().translate(0, leftHandY, 0)])],
      ['right-fist', right.geometry], ['left-arm', bakeRiderArm(ARM_STYLE, hands.sleeve, 2)], ['right-arm', bakeRiderArm(ARM_STYLE, hands.sleeve, 1)],
      ['world-javelin', merge([javelin.paint.clone(), javelin.metal.clone().deleteAttribute('uv')])],
    ];
    const material = new MeshBasicMaterial();
    try {
      const glb = staticGlb(parts.map(([name, geometry]): GlbPrimitive => ({ name, geometry, material, compactIndex: true,
        extras: { restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]), restBox: null, restSphere: null } })), 'nalati-spear');
      const rows: SpearPoolRows = { pool: { url: SPEAR_POOL_NAME, parts: parts.map(([name]) => name) },
        profile: { damage: SPEAR_PROFILE.damage, reach: SPEAR_PROFILE.reach, thrust: SPEAR_PROFILE.thrust, lance: SPEAR_PROFILE.lance,
          feel: SPEAR_PROFILE.feel, cues: SPEAR_PROFILE.cues, hitStop: SPEAR_PROFILE.hitStop },
        view: { poses: Object.fromEntries(Object.entries(SPEAR_VIEW.poses).map(([name, pose]) => [name, { pos: pose.pos.toArray(), q: pose.q.toArray() }])),
          elbows: { left: SPEAR_VIEW.elbows.left.toArray(), right: SPEAR_VIEW.elbows.right.toArray() },
          javelinGrip: hands.javelinGrip, tapMax: SPEAR_VIEW.tapMax,
          wrists: { left: left.wrist.clone().setY(left.wrist.y + leftHandY).toArray(), right: right.wrist.toArray() } } };
      return { glb, rows };
    } finally {
      for (const [, geometry] of parts) geometry.dispose();
      left.geometry.dispose(); material.dispose();
    }
  } finally { restore(); }
}
