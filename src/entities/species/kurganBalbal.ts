import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, paintNoise, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, step, clamp } from './rigs';
import { heightAt } from '../../world/Heightfield';

/**
 * Kurgan balbal — the Golden King's phase-II adds (elites-and-bosses.md: "two balbals step out of the wall niches, 2.5 m,
 * 220 hp each, amber cracks, the sabre breaks them"; mockup art/nalati-grasslands/round-2/5-bosses/boss-3-phase-2.png).
 *
 * A MINIMAL stone warrior, owned by the boss row (B13) because the balbal-warrior row (B11) had not built its rig when
 * the King needed adds. Kind `kurgan-balbal` so it never collides with B11's `balbal`; when B11 lands, the fight can
 * spawn theirs instead (one line in src/nalati/kurganBoss.ts) and this file can go.
 *
 * Carved granite, the POI statues' look (src/world/nalati/Balbals.ts: a heavy oval head, brow, drooping moustache, the
 * cup held to the chest), but the arms come free: the right swings a stone sabre. Amber light burns in the cracks (HDR
 * vertex colour — the bloom picks it up). Humanoid custom rig: body · spine · chest · head · arms · legs.
 *
 * Behaviour (`think`, 10 Hz; `mem` from the spawner): EMERGE — it grinds forward out of its niche along its facing for
 * `emergeT` s; then STALK at 1.3 m/s toward the player, inside `bounds` (minX, maxX, minZ, maxZ); inside 2.2 m it winds
 * the sabre up for 0.8 s and CUTS (18 within 2.5 m, ±70°). Stone: arrows do half (`damageMul`), a blade from close in
 * does ×1.5 — it is judged by where the player stood at the last tick, the same heuristic the King uses.
 * It floats on `mem.floorY` like the King (the chamber is not on the terrain). Dies crumbling to its knees and sinks into
 * the floor (`mem.deadT`); the fight hides it (no corpseFade: a fade clones the painterly material — a new program).
 */

export const KURGAN_BALBAL = 'kurgan-balbal';

const PALETTE = {
  stone: [0.56, 0.545, 0.515], stoneDark: [0.36, 0.35, 0.33], carve: [0.3, 0.29, 0.27], lichen: [0.72, 0.6, 0.3],
  amber: [1.0, 0.55, 0.12],
} satisfies Record<string, RGB>;

type Side = 'L' | 'R';
type BalbalBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
interface BalbalMem extends Record<string, number | undefined> {
  init?: number; st?: number; t?: number; cd?: number; hit?: number; hitT?: number;
  floorY?: number; emergeT?: number; minX?: number; maxX?: number; minZ?: number; maxZ?: number;
  emerge?: number; deadT?: number;
}

const _player = new THREE.Vector3();

function balbalPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  const amberHdr = P.amber.clone().multiplyScalar(4.5);
  return (out, x, y, z, _nx, ny, _nz, part) => {
    if (part === 'eye') { out.copy(amberHdr); return; }
    // weathered granite: a brush of light and dark, lichen on the tops, carved grooves darker
    const n = paintNoise.fbm(x * 6 + y * 2, z * 6 - y * 3, 3);
    mix(out, P.stone, P.stoneDark, 0.35 + 0.35 * n);
    if (part === 'carve') mix(out, out, P.carve, 0.7);
    if (ny > 0.35 && paintNoise.get(x * 9, z * 9 + y * 4) > 0.25) mix(out, out, P.lichen, 0.55);
    // the amber cracks: thin ridges of a noise field, burning
    const crack = Math.abs(paintNoise.get(x * 7.5 + y * 3.1, z * 7.5 - y * 2.7) + 0.4 * paintNoise.get(y * 11, x * 11 + z * 5));
    if (crack < 0.045 && part !== 'blade') mix(out, out, amberHdr, sstep(0.045, 0.015, crack));
  };
}

function buildBalbal(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.9, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.08, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.3, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.56, 0.01] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.27, 1.42, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.31, 1.15, 0.03] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.31, 0.93, 0.08] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.13, 0.86, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.14, 0.47, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.14, 0.08, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = balbalPaint(v);
  const parts: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // the pillar body: broad, flat, slightly tapering — a stela that learned to walk
  parts.push(loft([
    S(0, 0.78, 0, 0.27, 0.19, body), S(0, 0.95, 0, 0.29, 0.2, body, spine, 0.3), S(0, 1.12, 0, 0.3, 0.2, spine),
    S(0, 1.3, 0, 0.32, 0.21, spine, chest, 0.8), S(0, 1.44, 0, 0.3, 0.19, chest), S(0, 1.52, 0, 0.18, 0.13, chest),
  ], 14, 'stone', paint, true, true));
  // a belt groove and the cup held to the chest (left hand) — carved
  parts.push(loft([S(0, 0.92, 0, 0.3, 0.205, body), S(0, 0.97, 0, 0.3, 0.205, body)], 14, 'carve', paint, false, false));
  parts.push(skinPlain(new THREE.CylinderGeometry(0.07, 0.05, 0.11, 8).translate(0.06, 1.2, 0.2), chest, 'carve', paint));
  // the head: a heavy oval, the flattened face, brow, nose, a drooping moustache
  parts.push(loft([S(0, 1.55, 0.0, 0.1, 0.1, chest, head, 0.6), S(0, 1.62, 0.0, 0.19, 0.17, head), S(0, 1.76, 0.0, 0.21, 0.19, head), S(0, 1.9, -0.01, 0.17, 0.16, head), S(0, 1.98, -0.02, 0.07, 0.07, head)], 14, 'stone', paint, true, true));
  parts.push(skinPlain(new THREE.CapsuleGeometry(0.03, 0.24, 3, 8).rotateZ(Math.PI / 2).translate(0, 1.83, 0.17), head, 'carve', paint));
  parts.push(skinPlain(new THREE.CylinderGeometry(0.02, 0.045, 0.13, 6).rotateX(-0.2).translate(0, 1.76, 0.2), head, 'stone', paint));
  parts.push(skinPlain(new THREE.CapsuleGeometry(0.022, 0.2, 3, 6).rotateZ(Math.PI / 2 + 0.3).translate(0.07, 1.68, 0.19), head, 'carve', paint));
  parts.push(skinPlain(new THREE.CapsuleGeometry(0.022, 0.2, 3, 6).rotateZ(Math.PI / 2 - 0.3).translate(-0.07, 1.68, 0.19), head, 'carve', paint));
  for (const sx of [1, -1]) eyes.push(skinPlain(new THREE.SphereGeometry(0.03, 8, 6).scale(1.4, 0.6, 0.5).translate(sx * 0.07, 1.79, 0.18), head, 'eye', paint));
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    parts.push(loft([S(sx * 0.27, 1.45, 0, 0.1, 0.1, chest, sh, 0.6), S(sx * 0.3, 1.28, 0.01, 0.085, 0.08, sh), S(sx * 0.31, 1.15, 0.03, 0.08, 0.075, sh, el, 0.5), S(sx * 0.31, 1.02, 0.05, 0.075, 0.07, el), S(sx * 0.31, 0.93, 0.08, 0.07, 0.065, el, hand, 0.6)], 10, 'stone', paint, true, false));
    parts.push(skinPlain(new THREE.SphereGeometry(0.085, 8, 6).scale(1, 1.1, 1).translate(sx * 0.31, 0.88, 0.09), hand, 'stone', paint));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    parts.push(loft([S(sx * 0.13, 0.84, 0, 0.12, 0.12, body, hip, 0.5), S(sx * 0.14, 0.62, 0.005, 0.11, 0.11, hip), S(sx * 0.14, 0.47, 0.01, 0.1, 0.1, hip, knee, 0.5), S(sx * 0.14, 0.26, 0.015, 0.095, 0.095, knee), S(sx * 0.14, 0.1, 0.02, 0.1, 0.1, knee, foot, 0.6)], 10, 'stone', paint, true, false));
    parts.push(loft([S(sx * 0.14, 0.1, -0.04, 0.11, 0.08, foot), S(sx * 0.14, 0.06, 0.1, 0.1, 0.06, foot), S(sx * 0.14, 0.05, 0.2, 0.06, 0.04, foot)], 8, 'stone', paint, true, true));
  }
  // the stone sabre in the right hand: a thick carved blade pointing forward and up
  {
    const hand = B('armR_hand'), x = -0.31;
    hard.push(loft([S(x, 0.89, 0.1, 0.035, 0.035, hand), S(x, 0.89, 0.22, 0.09, 0.03, hand), S(x, 0.9, 0.3, 0.05, 0.025, hand)], 8, 'carve', paint, true, true, 'z'));
    hard.push(loft([S(x, 0.9, 0.3, 0.06, 0.02, hand), S(x, 0.92, 0.6, 0.07, 0.022, hand), S(x, 0.96, 0.9, 0.055, 0.018, hand), S(x, 1.0, 1.05, 0.01, 0.01, hand)], 8, 'blade', paint, true, true, 'z'));
  }
  void spine;
  return {
    bones, furParts: parts, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.9, bodyHalfLen: 0.55, bodyRadius: 0.34, headRadius: 0.2, legLen: 0.82, feet: [[0.14, 0.05], [-0.14, 0.05], [0.14, -0.05], [-0.14, -0.05]], halfWidth: 0.32, capsuleAxis: 'y' },
  };
}

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;

function animateBalbal(c: RigAnimCtx): void {
  const b = c.bones as BalbalBones, m = c.mem as BalbalMem, a = c.animal;
  if (!c.alive) m.deadT = (m.deadT ?? 0) + c.dt;
  const sink = Math.max(0, (m.deadT ?? 0) - 0.8) * 1.1;              // crumbles into the floor; the fight hides it after
  a.yOffset = (m.floorY ?? heightAt(a.position.x, a.position.z)) - heightAt(a.position.x, a.position.z) - sink;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 1.0, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const look = lookAngles(c, 1.8, 0.8, 0.4);
  const emerge = 1 - (m.emerge ?? 1);                                  // 1 while still stepping out of the niche: stiff, arms in
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  b.body.position.y = c.dims.bodyY - 0.05 * Math.abs(Math.sin(ph)) * moving - 0.4 * kneel - 0.2 * topple;
  let bodyP = 0.05 + 0.08 * moving + 1.3 * topple, spineY = 0;
  let armRx = 0.25 - 0.9 * emerge, armRz = -0.2, elR = -0.5;
  const atk = c.attack;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.62), cut = step(atk, 0.62, 0.78), rec = step(atk, 0.85, 1);
    armRx = L(L(0.25, -2.6, wind), 0.9, cut) * (1 - rec) + 0.25 * rec;
    armRz = L(L(-0.2, -0.7, wind), 0.3, cut) * (1 - rec) - 0.2 * rec;
    elR = L(L(-0.5, -0.8, wind), -0.1, cut) * (1 - rec) - 0.5 * rec;
    bodyP += L(L(0, -0.2, wind), 0.4, cut) * (1 - rec);
    spineY = L(L(0, 0.4, wind), -0.45, cut) * (1 - rec);
  }
  R(b.body, bodyP, 0, 0.04 * Math.sin(ph) * moving);
  R(b.spine, 0.04 + 0.1 * c.brace, spineY + look.yaw * 0.3, 0);
  R(b.chest, 0.02, look.yaw * 0.2, 0);
  R(b.head, -0.1 - look.pitch * 0.4 + 0.2 * c.flinch + 0.3 * kneel, look.yaw * 0.5, 0);
  const armSw = Math.sin(ph) * 0.3 * moving;
  R(b.armR_sh, armRx + armSw * 0.4 + 0.6 * dead, 0, armRz);
  R(b.armR_el, elR, 0, -0.1);
  R(b.armR_hand, 0.3, 0, 0);
  R(b.armL_sh, 0.1 - armSw - 0.5 * emerge + 0.6 * dead, 0, 0.18);
  R(b.armL_el, -1.4 + 0.5 * moving, 0.3, 0.3);                           // the cup arm stays bent at the chest
  R(b.armL_hand, 0.2, 0, 0);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    R(b[`leg${side}_hip`], -0.45 * lsw * moving + 0.15 * kneel - 0.4 * topple, 0, sx * 0.05);
    R(b[`leg${side}_knee`], (0.3 + 0.4 * Math.max(0, lsw)) * moving + 1.7 * kneel, 0, 0);
    R(b[`leg${side}_foot`], -0.15 * lsw * moving, 0, 0);
  }
}

const ST_EMERGE = 0, ST_STALK = 1, ST_ATTACK = 2;
const WALK = 1.3, SWING_R = 2.2, HIT_R = 2.6, DAMAGE = 18, WIND = 0.8, SWING = 1.25;

function thinkBalbal(a: Animal, c: ThinkCtx): void {
  const m = a.mem as BalbalMem;
  _player.copy(c.player);
  if (m.init !== 1) { m.init = 1; m.st = ST_EMERGE; m.t = 0; m.cd = 1; m.hitT = 0; m.emerge = 0; a.state = 'rise'; }
  m.t = (m.t ?? 0) + c.dt; m.cd = Math.max(0, (m.cd ?? 0) - c.dt);
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
  a.lookTarget.copy(c.player); a.lookWeight = m.st === ST_EMERGE ? 0.4 : 1;
  switch (m.st ?? ST_STALK) {
    case ST_EMERGE: {
      const T = m.emergeT ?? 1.6;
      m.emerge = Math.min(1, m.t / T);
      a.setMotion(a.yaw, 0.9, 0.5);
      if (m.t >= T) { m.st = ST_STALK; m.emerge = 1; c.sound('bear_growl'); }
      break;
    }
    case ST_STALK: {
      a.state = 'stalk';
      if (d < SWING_R && (m.cd ?? 0) <= 0) { m.st = ST_ATTACK; m.hit = 0; a.startAttack(SWING); a.setMotion(toPlayer, 0, 4); break; }
      a.setMotion(toPlayer, d > SWING_R * 0.85 ? WALK : 0, 2.4);
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 3);
      const p = a.attackPhase;
      if (p >= WIND / SWING && m.hit !== 1) {
        m.hit = 1;
        let off = toPlayer - a.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
        if (d <= HIT_R && Math.abs(off) < 1.25 && c.player.y < a.position.y + 2.5) { c.hurt(DAMAGE); c.sound('sailor_slash'); }
      }
      if (p >= 1 || p < 0) { a.cancelAttack(); m.st = ST_STALK; m.cd = 1.3; }
      break;
    }
    default: break;
  }
  // stay inside the chamber
  if (m.minX !== undefined && m.maxX !== undefined && m.minZ !== undefined && m.maxZ !== undefined && m.st !== ST_EMERGE) {
    a.position.x = clamp(a.position.x, m.minX, m.maxX); a.position.z = clamp(a.position.z, m.minZ, m.maxZ);
  }
}

registerSpecies({
  kind: KURGAN_BALBAL,
  label: 'Balbal',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: WALK,
  chargeDamage: DAMAGE,
  eyeGlow: [0.5, 0.25, 0.05], eyeGlowIntensity: 0.12,
  sounds: { call: 'bear_growl', hurt: 'crab_click', callEvery: [8, 16] },
  variants: [{ id: 'warrior', label: 'Balbal', weight: 1, rarity: 'uncommon', scale: [1.15, 1.2], hp: 220 }],
  build: buildBalbal,
  animate: animateBalbal,
  think: thinkBalbal,
  // stone: arrows glance off (half), a blade from close in breaks it (×1.5)
  damageMul: (_a, hitPoint) => (Math.hypot(hitPoint.x - _player.x, hitPoint.z - _player.z) < 3.8 ? 1.5 : 0.5),
});
