import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MeshBasicMaterial, Vector3 } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { gloveFist, riderArm } from '@wildshard/engine/player/nalatiArms';
import { byteWriter } from '../../../../scripts/bake-output.mjs';
import { merge } from './meleeGeo.ts';
import { installPortableMath } from '@wildshard/commons/bake/portableMath';

// Content-addressed geometry must use the same transcendental bits on arm64 and x64.
// Install before the source module constructs its authored pose quaternions too.
installPortableMath();
const { buildSpear, buildJavelin, SPEAR_PROFILE, SPEAR_VIEW } = await import('./spear.ts');

const spear = buildSpear(), javelin = buildJavelin(), { hands, leftHandY } = SPEAR_VIEW;
const restInv = SPEAR_VIEW.poses.rest.q.clone().invert();
const fist = (direction, mirror) => {
  const d = new Vector3(...direction).normalize().applyQuaternion(restInv);
  return gloveFist({ R: hands.radius, mirror, yaw: Math.atan2(d.x, d.z) - Math.atan2(mirror ? -hands.splay : hands.splay, 1) });
};
const left = fist(hands.left, true), right = fist(hands.right, false);
const parts = [
  ['spear-paint', spear.paint], ['spear-metal', spear.metal],
  ['javelin-paint', javelin.paint], ['javelin-metal', javelin.metal],
  ['held-spear', merge([spear.paint.clone(), left.geometry.clone().translate(0, leftHandY, 0)])],
  ['right-fist', right.geometry], ['left-arm', riderArm(hands.sleeve, 2)], ['right-arm', riderArm(hands.sleeve, 1)],
  ['world-javelin', merge([javelin.paint.clone(), javelin.metal.clone().deleteAttribute('uv')])],
];
const material = new MeshBasicMaterial();
const glb = staticGlb(parts.map(([name, geometry]) => ({ name, geometry, material, compactIndex: true,
  extras: { restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]), restBox: null, restSphere: null } })), 'nalati-spear');
const hash = createHash('sha256').update(glb).digest('hex');
const rows = { pool: { url: `/assets/nalati/baked/${hash}.glb`, parts: parts.map(([name]) => name) },
  profile: { damage: SPEAR_PROFILE.damage, reach: SPEAR_PROFILE.reach, thrust: SPEAR_PROFILE.thrust, lance: SPEAR_PROFILE.lance,
    feel: SPEAR_PROFILE.feel, cues: SPEAR_PROFILE.cues, hitStop: SPEAR_PROFILE.hitStop },
  view: { poses: Object.fromEntries(Object.entries(SPEAR_VIEW.poses).map(([name, pose]) => [name, { pos: pose.pos.toArray(), q: pose.q.toArray() }])),
    elbows: { left: SPEAR_VIEW.elbows.left.toArray(), right: SPEAR_VIEW.elbows.right.toArray() },
    javelinGrip: hands.javelinGrip, tapMax: SPEAR_VIEW.tapMax,
    wrists: { left: left.wrist.clone().setY(left.wrist.y + leftHandY).toArray(), right: right.wrist.toArray() } } };
const writer = byteWriter(process.argv.includes('--check'), 'spear');
writer.put(fileURLToPath(new URL(`../../../../public/assets/nalati/baked/${hash}.glb`, import.meta.url)), glb);
writer.put(fileURLToPath(new URL('../data/spear.generated.json', import.meta.url)), encodeCanonicalJson(rows));
writer.finish();
for (const [, geometry] of parts) geometry.dispose();
left.geometry.dispose(); material.dispose();
