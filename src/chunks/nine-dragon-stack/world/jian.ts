// The Neon Jian as the engine sword (P0-5c, a stand-in until lab P8 delivers its rigged jian + clips): the clean room's
// static model — the blade with its cyan edges, the TRELLIS dragon-head guard, the lacquered grip and the gloved fist on
// it, the red tassel and the fu talisman hanging from the guard — on the hero lab's viewmodel program, with the Fei Zhua
// gauntlet held still on the left. It hands the engine's Sword (src/player/Sword.ts) a `ShardSword`: the rig, a rest pose
// solved from the clean room's portrait layout (the round-6 mockups' framing: the long diagonal from the guard low right
// to the frame's centre) and a neutral portrait framing; the Sword swings it with its own moves from that rest.
//
// Sword model space: origin at the middle of the grip, +Y up the blade, +X across the edges, +Z the flat toward the eye.
// The jian's parts are built with the guard at y 0 (blade up to TIP_Y, grip down to −0.39): they are lifted by GRIP_MID.
import { type BufferGeometry, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { ShardSword } from '../../ChunkDef';
import { CHARGE, COMBO, HEAVY, SPRINT, key } from '../../../player/SwordMoves';
import { Kit } from './kit';
import { KitX, merge } from './hero/kitx';
import { glbBox, guardMatrix, loadGlb } from './hero/glb';
import {
  JIAN, TIP_Y, buildBlade, buildBladeClip, buildClaw, buildGauntlet, buildGrip, buildGripHand, buildGuardProcedural, buildTalisman, buildTassel,
} from './hero/weapon-parts';
import { decalAtlas, vmMaterial, vmUniforms, weaveTexture } from './hero/vm-material';

/** the grip's middle below the guard (the fist sits there) */
const GRIP_MID = 0.2;

/**
 * The clean room's portrait layout (src/dev/nine-dragon/vm/viewmodel.ts LAYOUT_PORTRAIT, the round-6 style-A framing):
 * the guard and the tip in NDC with the guard's depth (m), the Fei Zhua's wrist and elbow likewise. Solved for the phone
 * the mockups are drawn on (9:19.5) at the shard's portrait FOV (def.ts `fov.portrait`).
 */
// (the wrist raised from the clean room's −0.76: the engine's MOVE / ATTACK panel covers the frame's bottom sixth.)
// Round-6 scale (Jake's boards, 2026-09-26: "a thin distant sword + a small striped cylinder"): the guard 0.62 m from the
// eye, not 1.1 (the blade ~1.8× as wide on screen, the dragon guard and tassel large at the lower right); the Fei Zhua's
// claw hub 0.58 m out, not 1.3, the forearm running from it off the frame's bottom-left corner (its elbow behind the
// frame's edge), so the brass gauntlet fills that corner as in every mockup
const LAYOUT = { guard: [0.5, -0.42, 0.62], tip: [0.08, 0.0], wrist: [-0.5, -0.36, 0.58], elbow: [-1.7, -1.6], elbowDepth: 0.5, armRoll: -0.3 } as const;
const ASPECT = 402 / 874;
const PORTRAIT_FOV = 78;

/** the camera's half-extents at 1 m for the reference phone (Hor+ from the portrait base, as Sword.ts does) */
function halfExtents(): { tx: number; ty: number } {
  const ty = Math.tan(MathUtils.degToRad(PORTRAIT_FOV) / 2) / Math.sqrt(ASPECT);
  return { tx: ty * ASPECT, ty };
}

/** the jian's rest key and the gauntlet's pose (camera space) */
function solvePose(): { rest: ReturnType<typeof key>; wrist: Vector3; armQ: Quaternion } {
  const { tx, ty } = halfExtents();
  const ndc = (x: number, y: number, d: number): Vector3 => new Vector3(x * d * tx, y * d * ty, -d);
  const [gx, gy, gd] = LAYOUT.guard;
  const G = ndc(gx, gy, gd);
  // the tip's depth so the blade (guard → tip, TIP_Y) keeps its length
  let td = gd + 0.5;
  for (let i = 0; i < 60; i++) td += (TIP_Y - ndc(LAYOUT.tip[0], LAYOUT.tip[1], td).distanceTo(G)) * 0.8;
  const dir = ndc(LAYOUT.tip[0], LAYOUT.tip[1], td).sub(G).normalize();
  const grip = G.clone().addScaledVector(dir, -GRIP_MID);
  // Sword.ts scales a portrait rest pose (y × (1 + 0.1 p), z × (1 + 0.45 p)): undone here, the framing is set neutral
  const p = Math.min(1, (1 - ASPECT) * 1.6);
  const pos = new Vector3(grip.x, grip.y / (1 + 0.1 * p), grip.z / (1 + 0.45 * p));
  // the roll that turns the flat (+Z) most toward the eye
  const toEye = grip.clone().negate().normalize();
  let roll = 0, best = -2;
  for (let r = -Math.PI; r < Math.PI; r += Math.PI / 180) {
    const k = key(0, 0, 0, 0, dir.x, dir.y, dir.z, r);
    const d = new Vector3(0, 0, 1).applyQuaternion(k.q).dot(toEye);
    if (d > best) { best = d; roll = r; }
  }
  const rest = key(0, pos.x, pos.y, pos.z, dir.x, dir.y, dir.z, roll);
  // the gauntlet: the wrist at its NDC point, the forearm back to the elbow off-frame low left, its back (+z) up
  const [wx, wy, wd] = LAYOUT.wrist;
  const wrist = ndc(wx, wy, wd);
  const elbow = ndc(LAYOUT.elbow[0], LAYOUT.elbow[1], wd * LAYOUT.elbowDepth);
  const y = wrist.clone().sub(elbow).normalize();
  const face = new Vector3(0, 1, 0.35);
  const z = face.addScaledVector(y, -face.dot(y)).normalize();
  const x = new Vector3().crossVectors(y, z);
  const armQ = new Quaternion().setFromAxisAngle(y, LAYOUT.armRoll).multiply(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)));
  return { rest, wrist, armQ };
}

export async function jianSword(): Promise<ShardSword> {
  const material = vmMaterial(vmUniforms(weaveTexture(), decalAtlas()));
  const lift = (g: BufferGeometry): BufferGeometry => g.translate(0, GRIP_MID, 0);
  // the blade, the clip, the grip (Kit + KitX parts merged: the same attributes), the tassel and the talisman at their pivots
  const k = new Kit();
  const x = new KitX();
  buildBlade(k);
  buildBladeClip(x);
  buildGrip(k, x);
  const tassel = new KitX();
  buildTassel(tassel);
  const talisman = new KitX();
  buildTalisman(talisman);
  const sword = lift(merge([k.build(), x.build(), tassel.build().translate(-0.036, -0.03, 0.03), talisman.build().translate(0.03, -0.066, 0.036)]));
  const hand = new KitX();
  buildGripHand(hand);
  const arms = lift(hand.build());
  // the dragon-head guard: the TRELLIS head in profile (the clean room's), else the procedural one
  let guard: BufferGeometry;
  try {
    const url = '/assets/nine-dragon/lab/guard.glb';
    guard = await loadGlb(url, { kind: 20, wash: 0xba9444, lumLo: 0.2, lumHi: 1.35, ao: 0.9, clipBack: 0.2, matrix: guardMatrix(await glbBox(url), 0.115, -0.004, 0.006, 0) });
  } catch {
    const gx = new KitX();
    buildGuardProcedural(gx);
    guard = gx.build().scale(1.3, 1.3, 1.3);
  }
  // the Fei Zhua on the left: the gauntlet with its talons folded (the grapple lab animates them later)
  const gk = new Kit();
  const gxx = new KitX();
  buildGauntlet(gk, gxx);
  const claw = new KitX();
  buildClaw(claw, 0);
  const gauntlet = merge([gk.build(), gxx.build(), claw.build().translate(0, 0.002, 0.004)]);
  const { rest, wrist, armQ } = solvePose();
  return {
    rig: {
      sword, arms, material,
      tipY: TIP_Y + GRIP_MID, baseY: JIAN.root + GRIP_MID,
      extras: [{ geometry: lift(guard), material }],
      left: { geometry: gauntlet, material, pos: wrist, q: armQ },
    },
    moves: { rest, charge: CHARGE, sprint: SPRINT, combo: COMBO, heavy: HEAVY },
    framing: { shrink: 0, dx: 0, dy: 0, tilt: 0, yaw: 0 },
    portraitPullX: 0,
  };
}
