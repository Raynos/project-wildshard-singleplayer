import { Vector3 } from 'three';
import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { DRIFTWOOD_STRIKES, driftwoodContact, type DriftwoodContactPorts } from '../combat/strikes';

/**
 * The Drowned Captain's fight (./captain.ts has the rig, the look and the species row): renderer-free, so the same policy
 * runs on the browser's Animal through ThinkCtx and on a trusted native body through a headless host's ports (SF72).
 */
export interface CaptainPorts<A extends AnimalSim> extends DriftwoodContactPorts<A> {
  readonly dt: number;
  readonly calm: boolean;
  /** the decision stream (the manager's Rng in the browser) */
  readonly rng: { range: (min: number, max: number) => number; next: () => number };
  sound: (name: string) => void;
  readonly world: { readonly splash?: ((at: A['position'], strength: number) => void) | undefined };
  heightAt: (x: number, z: number) => number;
  claim: (actor: A) => boolean;
  mayAttack: (actor: A) => boolean;
}

export interface CaptainMem extends Record<string, number> {
  init: number; st: number; cd: number; hitT: number; hit: number; combo: number;
  rise: number; rising: number; sinking: number; subT: number; burstX: number; burstZ: number;
  poolX: number; poolZ: number; arena: number; awake: number; phase: number;
}

const ST_HIDE = 0, ST_RISE = 1, ST_FIGHT = 2, ST_ATTACK = 3, ST_SINK = 4, ST_UNDER = 5;
const SWING_R = 2.3, HIT_R = 2.5, BURST_R = 3, BURST_DMG = 16;
/** the cut's damage (the species row's chargeDamage) */
export const SWING_DMG = 24;
/** how far under the pool he waits (m, his yOffset while hidden; the rig lerps up from it) */
export const UNDER = -2.8;
const WADE = [0, 1.2, 1.35, 1.7], WINDUP = [0, 0.7, 0.62, 0.5], COOLDOWN = [0, 1.4, 1.2, 0.8], SINK_EVERY = [0, 0, 7, 5];
const UNDER_T = 1.1;
/** E297: how far out he waits while two others hold the attack tokens (m) */
const HOLD_R = 3.4;
const _bub = new Vector3();

/** the fight phase by hp: 1, 2, 3 */
export function captainPhase(hp: number, maxHp: number): number { const f = hp / Math.max(1, maxHp); return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }

function decideCaptain<A extends AnimalSim>(a: A, c: CaptainPorts<A>): void {
  const m = a.mem as CaptainMem;
  if (!m.init) {
    m.init = 1; m.st = ST_HIDE; m.cd = 1; m.hitT = 0; m.hit = 0; m.combo = 0; m.rise = 0; m.rising = 0; m.sinking = 0; m.subT = 0;
    const set = a.mem;   // poolX / poolZ / arena / awake may have been set by the spawner before the first tick
    m.poolX = set['poolX'] ?? a.position.x; m.poolZ = set['poolZ'] ?? a.position.z; m.arena = set['arena'] ?? 22; m.awake = set['awake'] ?? 0; m.phase = 1;
    a.state = 'hide'; a.yOffset = UNDER;
  }
  const phase = captainPhase(a.hp, a.maxHp); m.phase = phase;
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  const playerFromPool = Math.hypot(c.player.x - m.poolX, c.player.z - m.poolZ);
  a.lookTarget.copy(c.player); a.lookWeight = m.st === ST_HIDE || m.st === ST_UNDER ? 0 : 1;
  const hit = a.lastHitT > m.hitT; if (hit) m.hitT = a.lastHitT;
  m.cd = Math.max(0, m.cd - c.dt);
  m.subT += c.dt;
  switch (m.st) {
    case ST_HIDE:
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2); a.setStrafe(0);
      if (m.awake) { m.st = ST_RISE; m.rising = 1; m.sinking = 0; c.sound('sailor_groan'); c.world.splash?.(a.position, 2); }
      break;
    case ST_RISE:
      a.state = 'rise'; a.setMotion(toPlayer, 0, 2);
      if (!m.rising) { m.st = ST_FIGHT; m.subT = 0; m.cd = 0.6; }
      break;
    case ST_FIGHT: {
      a.state = 'stalk';
      if (hit && phase === 1) a.cancelAttack();
      if (SINK_EVERY[phase] && m.subT > (SINK_EVERY[phase] ?? 99) && m.cd <= 0) { m.st = ST_SINK; m.sinking = 1; m.rising = 0; c.world.splash?.(a.position, 1.4); c.sound('sailor_groan'); break; }
      if (!c.calm && d < SWING_R && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.hit = 0; a.startAttack((WINDUP[phase] ?? 0.7) + 0.35); a.setMotion(toPlayer, 0, 6); c.sound('sailor_groan'); break; }
      // E297 fight rules: two others attacking — he wades to just out of reach and waits his turn
      if (!c.calm && playerFromPool < m.arena) a.setMotion(toPlayer, d > (c.mayAttack(a) ? SWING_R * 0.85 : HOLD_R) ? WADE[phase] ?? 1.2 : 0, 3);
      else {   // you ran: he wades back to the pool and glares
        const hx = m.poolX - a.position.x, hz = m.poolZ - a.position.z;
        if (Math.hypot(hx, hz) > 1) a.setMotion(Math.atan2(hx, hz), (WADE[phase] ?? 1.2) * 0.8, 2.5); else a.setMotion(toPlayer, 0, 2);
      }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 5);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) {
        a.cancelAttack();
        if (phase === 3 && !m.combo) { m.combo = 1; m.st = ST_ATTACK; m.hit = 0; a.startAttack(0.55); break; }   // the second cut, straight after
        m.combo = 0; m.st = ST_FIGHT; m.cd = COOLDOWN[phase] ?? 1.4;
      }
      break;
    }
    case ST_SINK:
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2);
      if (!m.sinking) {
        // pick where he comes up: a couple of metres from you, inside the arena; bubbles mark it
        const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(1.2, 2.2);
        let bx = c.player.x + Math.cos(ang) * r, bz = c.player.z + Math.sin(ang) * r;
        const fx = bx - m.poolX, fz = bz - m.poolZ, fd = Math.hypot(fx, fz);
        if (fd > m.arena - 2) { bx = m.poolX + (fx / fd) * (m.arena - 2); bz = m.poolZ + (fz / fd) * (m.arena - 2); }
        m.burstX = bx; m.burstZ = bz; m.st = ST_UNDER; m.subT = 0;
      }
      break;
    case ST_UNDER: {
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2);
      // the telegraph: bubbles where he will burst
      if (c.rng.next() < 0.85) { _bub.set(m.burstX + c.rng.range(-1, 1), c.heightAt(m.burstX, m.burstZ), m.burstZ + c.rng.range(-1, 1)); c.world.splash?.(_bub, 0.3); }
      if (m.subT > UNDER_T) {
        a.place(m.burstX, m.burstZ, toPlayer);
        m.st = ST_RISE; m.rising = 1; m.subT = 0;
        c.world.splash?.(a.position, 2.2); c.sound('sailor_slash');
        driftwoodContact(a, c, { ...DRIFTWOOD_STRIKES.burst, damage: BURST_DMG, shape: { kind: 'point', radius: BURST_R, exclusive: true } });
      }
      break;
    }
    default: break;
  }
}

function strikeCaptain<A extends AnimalSim>(a: A, c: CaptainPorts<A>): void {
  const m = a.mem as CaptainMem, p = a.attackPhase;
  if (m.st !== ST_ATTACK || p < 0) return;
  const phase = captainPhase(a.hp, a.maxHp), dur = (WINDUP[phase] ?? 0.7) + 0.35;
  if (p >= (WINDUP[phase] ?? 0.7) / dur + 0.04 && !m.hit) { m.hit = 1; if (driftwoodContact(a, c, { ...(m.combo ? DRIFTWOOD_STRIKES.second : DRIFTWOOD_STRIKES.swing), shape: { kind: 'point', radius: HIT_R } })) c.sound('sailor_slash'); }
}
const STATES = ['hide', 'rise', 'fight', 'attack', 'sink', 'under'] as const;
/** The captain's authored fight (10 Hz decisions, the strike on the next body step) over any native body. */
export class CaptainBrain<A extends AnimalSim> extends CreatureBrain<typeof STATES[number], A, CaptainPorts<A>> {
  private strikeStep = false;
  constructor(actor: A) { super(actor, STATES); }
  override think(ctx: CaptainPorts<A>): void {
    decideCaptain(this.actor, ctx);
    this.strikeStep = true;
    const state = STATES[this.actor.mem['st'] ?? 0];
    if (state !== undefined) this.transition(state);
  }
  override act(ctx: CaptainPorts<A>): void {
    if (!this.strikeStep) return;
    this.strikeStep = false; strikeCaptain(this.actor, ctx);
  }
}