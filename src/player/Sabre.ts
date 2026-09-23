import * as THREE from 'three';
import { Sword, type SwordWorld, type SwordRig, type SwordMoveSet } from './Sword';
import type { Targets } from './Crossbow';
import { key, type Move } from './SwordMoves';
import { getAimTargets } from './AimTargets';
import { tube, blob, xf, merge, lin, forearm, meleeMaterial, type ColorAt } from './meleeGeo';

/**
 * Sabre — the Nalati kylysh (ASKS N6, plan row B3; design docs/design/nalati/combat.md § D; mockup
 * art/nalati-grasslands/round-2/1-combat/combat-D-mounted-sabre.png): Driftwood's sword (Sword.ts / SwordMoves.ts) with a
 * curved painterly steel blade, a gold guard and pommel, a single rider's hand in the red embroidered sleeve, and its own
 * curved arcs.
 *
 *   const sabre = new Sabre({ game, sky, player, forest }, targets, { allowUnlocked });
 *   kit: new Weapons(sabre, rifle, [...], { baseId: 'sabre', baseName: 'Sabre' })    // Weapons.ts (see nalatiKit.ts)
 *
 * On foot it IS the sword: SLASH → BACKHAND → FINISHER on LMB / F / a LOOK tap (COMBO_GAP 0.6 s), the charged HEAVY on
 * RMB / the touch HEAVY disc (hold 0.45 s), the lunge, the hit-stop, the trail. Numbers per the design: 24 / 24 / 32,
 * heavy 48 (base 24 × the moves' 1 / 1 / 1.33 / 2), reach 2.2 m, and every move 10 % quicker (`swingScale` 0.9).
 * The arcs are the sabre's own (SABRE_MOVES): the wrist rolls so the curved edge leads, the finisher is a rising diagonal
 * cut, and the ribbons are a cold blue-white (the mockup's streak) riding the blade's curve (`SwordRig.tipX`).
 *
 * MOUNTED (the B7 riding row sets it — `sabre.mount = { speed, yaw }` every frame in the saddle, `null` on foot): a tap is
 * ONE wide pass slash (PASS_LEFT / PASS_RIGHT) on whichever side the nearest live animal within PASS_SENSE m is relative
 * to the horse's heading (none: the side you are looking to), reach 2.8 m, the fan pitched ~20° down (wolves are low),
 * damage 24 × (1 + v / 12) × the pass chain, a 0.7 s cooldown, no lunge (the horse does the moving). The heavy still
 * works in the saddle. Mounted hits within CHAIN_WINDOW s of each other chain: +10 % per link up to ×1.4 —
 * `passChain` (hits in the running chain, 0 = none) and `passChainLeft` (s until it lapses) feed the HUD's "2 HIT" chip.
 */

const DAMAGE = 24;               // base: 24 / 24 / 32 combo, 48 heavy
const SPEED = 0.9;               // every move's duration × this (the sabre is lighter and quicker than the iron sword)
const MOUNT_REACH = 2.8;
const MOUNT_COOLDOWN = 0.7;      // s between pass slashes
const PASS_SENSE = 6;            // m — which side the pass slash goes: the nearest live animal inside this radius
const CHAIN_WINDOW = 3;          // s — mounted hits this close together chain
const CHAIN_STEP = 0.1, CHAIN_MAX = 1.4;

const BLADE_L = 0.62;            // m, guard to tip (the sabre is longer than the wooden sword's 0.52)
const CURVE = 0.12;              // m the tip sits back from the grip's line (toward -X, the spine side)

// ───────────────────────────── geometry (sword model space: +Y up the blade, +X the edge, +Z the flat toward the eye) ─────────────────────────────

const STEEL = lin(0xd3d6d9), STEEL_EDGE = lin(0xffffff), STEEL_SPINE = lin(0x8b9199), STEEL_FULLER = lin(0x6a7078);
const GOLD = lin(0xd9a441), GOLD_LIGHT = lin(0xf3d07a), GOLD_DARK = lin(0x8a5a1e);
const GRIP = lin(0x3b2417), GRIP_LIGHT = lin(0x5e3b25);

/** blade section at height y: a lens with the edge on +X and a rounded spine on -X; points carry a colour role */
const SECTION: [number, number, 'edge' | 'bevel' | 'flat' | 'fuller' | 'spine'][] = [
  [1, 0, 'edge'], [0.62, 0.45, 'bevel'], [0.15, 0.8, 'flat'], [-0.35, 0.95, 'fuller'], [-0.8, 0.9, 'spine'], [-1, 0.4, 'spine'],
  [-1, -0.4, 'spine'], [-0.8, -0.9, 'spine'], [-0.35, -0.95, 'fuller'], [0.15, -0.8, 'flat'], [0.62, -0.45, 'bevel'],
];

/** rest: hand low right, the curved blade rising up-left toward the frame centre (the mockup's hold) */
export const SABRE_REST = key(0, 0.3, -0.27, -0.52, -0.3, 0.72, -0.62, 0.2);
const SABRE_CHARGE = key(0, 0.27, -0.08, -0.5, 0.2, 0.93, 0.3, 0.25);
const SABRE_SPRINT = key(0, 0.35, -0.47, -0.58, -0.18, 0.5, -0.85, 0.7);

function buildSabre(material: THREE.Material): SwordRig & { tipX: number } {
  const parts: THREE.BufferGeometry[] = [];
  const guardY = 0.062, y0 = guardY + 0.012, tipY = y0 + BLADE_L;
  // ── blade: the centreline bows back quadratically; the width narrows to 70 % then flares (the yelman) before the point ──
  const cx = (f: number) => -CURVE * f * f;
  const half = (f: number) => (f < 0.72 ? 0.021 - 0.004 * f / 0.72 : f < 0.86 ? 0.017 + 0.004 * (f - 0.72) / 0.14 : 0.021 * Math.max(0, 1 - (f - 0.86) / 0.14) ** 0.8);
  const thick = (f: number) => 0.0042 - 0.0026 * f;
  const fs = [0, 0.06, 0.14, 0.24, 0.34, 0.44, 0.54, 0.64, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98, 1];
  const rings = fs.map((f) => {
    const w = Math.max(0.0006, half(f)), t = Math.max(0.0004, thick(f)), c = cx(f), y = y0 + BLADE_L * f;
    // near the point the edge sweeps up toward the spine: shift the section toward -X so the tip sits on the back line
    const shift = f > 0.86 ? -w * 0.5 * (f - 0.86) / 0.14 : 0;
    return SECTION.map(([sx, sz]) => new THREE.Vector3(c + shift + sx * w, y, sz * t));
  });
  const roleCol: Record<string, THREE.Color> = { edge: STEEL_EDGE, bevel: STEEL_EDGE.clone().lerp(STEEL, 0.4), flat: STEEL, fuller: STEEL_FULLER, spine: STEEL_SPINE };
  const bladeCol: ColorAt = (v, a, out) => {
    const i = Math.round(a * SECTION.length) % SECTION.length;
    const role = SECTION[i]?.[2] ?? 'flat';
    out.copy(roleCol[role] ?? STEEL);
    if (role === 'fuller' && v > 0.7) out.copy(STEEL); // the fuller runs out before the yelman
    return out.lerp(STEEL_EDGE, 0.18 * v);          // the steel brightens toward the point (a painted sky reflection)
  };
  parts.push(tube(rings, bladeCol, { capStart: true }));
  // ── guard: a gold bar with down-swept quillons ending in balls, a langet over the blade root ──
  const quillon: THREE.Vector3[][] = [];
  for (let k = 0; k <= 8; k++) {
    const u = k / 8, x = -0.058 + 0.116 * u, droop = -0.012 * (2 * u - 1) ** 2, r = 0.0075 + 0.0045 * Math.cos((u - 0.5) * Math.PI);
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ring.push(new THREE.Vector3(x, guardY + droop + Math.cos(a) * r, Math.sin(a) * r * 1.25)); }
    quillon.push(ring);
  }
  parts.push(tube(quillon, (_v, a, out) => out.copy(GOLD).lerp(a < 0.5 ? GOLD_LIGHT : GOLD_DARK, Math.abs(Math.sin(a * Math.PI * 2)) * 0.6)));
  for (const s of [-1, 1]) parts.push(xf(blob(0.0105, 0.0105, 0.012, GOLD, 10, 0.4), s * 0.06, guardY - 0.012, 0));
  parts.push(xf(blob(0.019, 0.022, 0.011, GOLD_LIGHT, 12, 0.35), -0.002, guardY + 0.006, 0));                     // the langet / collar
  // ── grip: dark leather with gold wire wraps; a gold ferrule under the guard ──
  const grip: THREE.Vector3[][] = [];
  for (let k = 0; k <= 12; k++) { const y = -0.056 + (guardY - 0.004 + 0.056) * (k / 12); const r = 0.0145 + 0.0022 * Math.sin((k / 12) * Math.PI); const ring: THREE.Vector3[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ring.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.85)); } grip.push(ring); }
  parts.push(tube(grip, (v, a, out) => (Math.abs(((v * 9 + a * 0.9) % 1) - 0.5) < 0.09 ? out.copy(GOLD) : out.copy(GRIP).lerp(GRIP_LIGHT, 0.5 + 0.5 * Math.sin(a * Math.PI * 2)))));
  // ── pommel: a gold cap, canted toward the edge like a kylysh's ──
  parts.push(xf(blob(0.019, 0.015, 0.016, GOLD, 12, 0.45), 0.006, -0.066, 0, 0, 0, -0.35));
  parts.push(xf(blob(0.007, 0.007, 0.007, GOLD_LIGHT, 8, 0.2), 0.016, -0.076, 0));
  // ── the rider's right hand round the grip; the forearm (its own rig, the cheap elbow) leaves toward the lower right ──
  const restInv = SABRE_REST.q.clone().invert();
  const armDir = new THREE.Vector3(0.86, -0.42, 0.28).normalize().applyQuaternion(restInv);
  parts.push(forearm(armDir, 0.62, 0.016, { part: 'fist', fistLen: 0.09 }));
  const arms = forearm(armDir, 0.62, 0.016, { part: 'arm', fistLen: 0.09 });
  const sword = merge(parts);
  return { sword, arms, tipY, baseY: y0, tipX: cx(1), material };
}

// ───────────────────────────── the sabre's arcs ─────────────────────────────

const ice = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const WIDE = { yaws: [0, -0.18, 0.18, -0.36, 0.36, -0.55, 0.55], pitches: [-0.3, 0.0, -0.6, -0.9] };
const DIAG = { yaws: [0, -0.14, 0.14, -0.3, 0.3], pitches: [0.05, -0.25, -0.5, -0.75, -0.95] };


const S_SLASH: Move = {
  name: 'slash',
  keys: [
    key(0.07, 0.44, -0.22, -0.5, 0.66, 0.6, -0.45, 1.0),      // cocked high right, the edge rolled to lead
    key(0.13, 0.2, -0.3, -0.47, -0.62, 0.55, -0.56, 0.75),    // sweeping across, the curve dragging the tip behind
    key(0.24, -0.06, -0.4, -0.46, -0.9, 0.05, -0.43, 0.45),   // out low left: a falling arc, not a flat line
  ],
  windup: 0.07, slashEnd: 0.24, total: 0.35,
  damage: 1, stagger: 0, sweep: 1, hitStop: 0.045, fan: WIDE,
  trail: { from: 0.58, color: ice(0.78, 0.92, 1), alpha: 0.65, inner: 0, life: 0.14 },
};
const S_BACKHAND: Move = {
  name: 'backhand',
  keys: [
    key(0.06, -0.12, -0.38, -0.48, -0.84, 0.2, -0.5, -0.3),    // cocked low left
    key(0.125, 0.12, -0.26, -0.5, 0.05, 0.72, -0.69, -0.55),   // rising through the centre
    key(0.22, 0.42, -0.14, -0.5, 0.86, 0.46, -0.22, -0.7),     // high right: a rising arc
  ],
  windup: 0.06, slashEnd: 0.22, total: 0.34,
  damage: 1, stagger: 0, sweep: -1, hitStop: 0.045, fan: WIDE,
  trail: { from: 0.58, color: ice(0.72, 0.88, 1), alpha: 0.65, inner: 0, life: 0.14 },
};
const S_FINISHER: Move = {
  name: 'finisher',
  keys: [
    key(0.1, 0.34, -0.04, -0.48, 0.36, 0.9, -0.1, 0.5),        // raised high right, over the shoulder
    key(0.19, 0.1, -0.2, -0.47, -0.42, 0.44, -0.79, 0.35),     // a hooked diagonal through the centre
    key(0.28, -0.16, -0.46, -0.44, -0.7, -0.36, -0.62, 0.15),  // low left
  ],
  windup: 0.1, slashEnd: 0.28, total: 0.44,
  damage: 16 / 12, stagger: 0.25, sweep: 0.5, hitStop: 0.06, fan: DIAG,
  trail: { from: 0.5, color: ice(0.86, 0.95, 1), alpha: 0.75, inner: 0.05, life: 0.16 },
};
const S_HEAVY: Move = {
  name: 'heavy',
  keys: [
    key(0.06, 0.3, -0.02, -0.5, 0.3, 0.88, 0.38, 0.2),
    key(0.17, 0.06, -0.18, -0.52, -0.2, 0.55, -0.81, 0.1),
    key(0.3, -0.14, -0.5, -0.44, -0.58, -0.44, -0.68, 0.0),
  ],
  windup: 0.06, slashEnd: 0.3, total: 0.62,
  damage: 2, stagger: 1, sweep: 0.35, hitStop: 0.08, fan: DIAG,
  trail: { from: 0.3, color: ice(0.9, 0.97, 1), alpha: 1.0, inner: 0.35, life: 0.22 },
};
/** mounted: a wide pass on the right — high forward-right, down and back along the horse's flank */
export const PASS_RIGHT: Move = {
  name: 'pass-right',
  keys: [
    key(0.09, 0.36, -0.08, -0.5, 0.35, 0.8, -0.5, 1.2),      // raised forward-right
    key(0.18, 0.4, -0.3, -0.5, 0.55, -0.05, -0.83, 1.4),     // cutting down across the lower right
    key(0.3, 0.38, -0.42, -0.36, 0.75, -0.45, -0.2, 1.5),    // follow-through low right, trailing back along the flank
  ],
  windup: 0.09, slashEnd: 0.3, total: 0.5,
  damage: 1, stagger: 1, sweep: -1, hitStop: 0.05, reach: MOUNT_REACH,
  fan: { yaws: [-0.35, -0.6, -0.85, -1.1, -1.35], pitches: [-0.2, -0.35, -0.55, -0.8] },
  trail: { from: 0.3, color: ice(0.8, 0.94, 1), alpha: 0.9, inner: 0.2, life: 0.2 },
};
/** mounted: the backhand pass on the left */
export const PASS_LEFT: Move = {
  name: 'pass-left',
  keys: [
    key(0.09, 0.25, -0.12, -0.5, -0.1, 0.85, -0.5, -0.4),    // raised, cocked across the body
    key(0.18, 0.05, -0.3, -0.52, -0.6, -0.05, -0.8, -0.7),   // the backhand down across the lower left
    key(0.3, -0.15, -0.42, -0.4, -0.8, -0.45, -0.2, -0.9),   // follow-through low left
  ],
  windup: 0.09, slashEnd: 0.3, total: 0.5,
  damage: 1, stagger: 1, sweep: 1, hitStop: 0.05, reach: MOUNT_REACH,
  fan: { yaws: [0.35, 0.6, 0.85, 1.1, 1.35], pitches: [-0.2, -0.35, -0.55, -0.8] },
  trail: { from: 0.3, color: ice(0.8, 0.94, 1), alpha: 0.9, inner: 0.2, life: 0.2 },
};
export const SABRE_MOVES: SwordMoveSet = { rest: SABRE_REST, charge: SABRE_CHARGE, sprint: SABRE_SPRINT, combo: [S_SLASH, S_BACKHAND, S_FINISHER], heavy: S_HEAVY };

// ───────────────────────────── the weapon ─────────────────────────────

export interface SabreOptions { allowUnlocked?: boolean }
/** the B7 riding hook: the horse's ground speed (m/s) and heading (rad, the player's yaw convention) */
export interface MountState { speed: number; yaw: number }

export class Sabre extends Sword {
  /** set by the riding code every frame in the saddle (`null` on foot): taps become the pass slash */
  mount: MountState | null = null;
  /** mounted hits in the running pass chain (0 = none) — the HUD's "2 HIT" chip */
  passChain = 0;
  private chainT = 0;
  private mountCd = 0;

  constructor(world: SwordWorld, targets?: Targets, opts: SabreOptions = {}) {
    const rig = buildSabre(meleeMaterial(world.sky));
    super(world, targets, { allowUnlocked: opts.allowUnlocked ?? false, rig, moves: SABRE_MOVES, damage: DAMAGE });
    this.swingScale = SPEED;
    this.onMoveHit = (move) => {
      if (move !== PASS_LEFT && move !== PASS_RIGHT) return;
      this.passChain = this.chainT > 0 ? this.passChain + 1 : 1;
      this.chainT = CHAIN_WINDOW;
    };
  }

  get mounted(): boolean { return this.mount !== null; }
  /** s until the pass chain lapses */
  get passChainLeft(): number { return this.chainT; }

  override tryFire(): void {
    const m = this.mount;
    if (m === null) { super.tryFire(); return; }
    if (this.mountCd > 0 || this.chargingHeavy) return;
    const side = this.passSide(m);
    const chainMul = Math.min(CHAIN_MAX, 1 + CHAIN_STEP * (this.chainT > 0 ? this.passChain : 0));
    this.damage = Math.round(DAMAGE * (1 + Math.max(0, m.speed) / 12) * chainMul);
    if (this.strike(side < 0 ? PASS_LEFT : PASS_RIGHT, false)) this.mountCd = MOUNT_COOLDOWN;
  }

  /** −1 = left, +1 = right of the horse's heading: the nearest live animal within PASS_SENSE, else the way you look */
  private passSide(m: MountState): number {
    const p = this.player.position;
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw), rx = Math.cos(m.yaw), rz = -Math.sin(m.yaw);
    let best = Infinity, side = 0;
    for (const t of getAimTargets()) {
      if (!t.alive || t.hidden === true) continue;
      const dx = t.position.x - p.x, dz = t.position.z - p.z, d = Math.hypot(dx, dz);
      if (d > PASS_SENSE || d >= best) continue;
      if (dx * fx + dz * fz < -2) continue; // well behind: already passed
      best = d; side = dx * rx + dz * rz >= 0 ? 1 : -1;
    }
    if (side !== 0) return side;
    const look = Math.atan2(Math.sin(this.player.yaw - m.yaw), Math.cos(this.player.yaw - m.yaw));
    return look > 0 ? -1 : 1; // yaw grows to the left
  }

  override update(dt: number, t: number): void {
    this.mountCd = Math.max(0, this.mountCd - dt);
    if (this.chainT > 0) { this.chainT = Math.max(0, this.chainT - dt); if (this.chainT === 0) this.passChain = 0; }
    if (!this.swinging) this.damage = DAMAGE; // a pass slash sets its own number for its one swing
    super.update(dt, t);
  }
}
