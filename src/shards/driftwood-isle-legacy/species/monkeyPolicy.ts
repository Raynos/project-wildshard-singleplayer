import { Vector3 } from 'three';
import { CreatureBrain } from '@wildshard/engine/ai/CreatureBrain';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { DRIFTWOOD_STRIKES, driftwoodContact, type DriftwoodContactPorts } from '../combat/strikes';

/**
 * The Coconut Monkey's renderer-free policy pieces (./monkey.ts has the rig, the look, the species row and the shipping
 * decision with its shared cooldown stream): perch choice, the bite / coconut strike and the brain shell, over any native
 * body, so the browser's Animal (through ThinkCtx) and a trusted headless host's body (through its ports) run the same code.
 */
export interface MonkeyMem extends Record<string, number> {
  init: number; cd: number; under: number; hitT: number; fled: number; onGround: number; st: number; hx: number; hz: number;
  perch: number; px: number; pz: number; bx: number; bz: number; perchH: number;
  drop: number; vy: number; land: number; climb: number; bite: number; hit: number; gt: number; fleeTo: number; bit: number;
}

export const ST_PERCH = 0, ST_GROUND_IDLE = 1, ST_ATTACK = 2, ST_DROP = 3, ST_GROUND = 4, ST_RETURN = 5, ST_CLIMB = 6;
export const THROW_R = 14, THROW_DUR = 1.0, THROW_RELEASE = 0.62, BITE_R = 1.3, BITE_DAMAGE = 6, BITE_DUR = 0.9 /* the bite lands at 0.45 → a 0.41 s readable wind-up */, UNDER_R = 2.6, UNDER_T = 2.0, RUN = 3.2;
/** E297 fight rules: a monkey on the sand waiting its turn (two others attacking) hangs back this far (m) */
export const HOLD_R = 3.4;

/** What perch choice reads: the palm crowns and trunk feet, the troop, the decision stream and the ground. */
export interface MonkeyPerchPorts<A extends AnimalSim> {
  readonly world: { readonly perches?: readonly A['position'][] | undefined; readonly perchBases?: readonly A['position'][] | undefined };
  readonly herd: readonly A[] | null;
  /** the decision stream (the manager's Rng in the browser) */
  readonly rng: { next: () => number };
  heightAt: (x: number, z: number) => number;
}
/** What the strike reads: the contact ports, the sound and the coconut lob (the shard's projectile owner). */
export interface MonkeyStrikePorts<A extends AnimalSim> extends DriftwoodContactPorts<A> {
  sound: (name: string) => void;
  readonly world: { readonly throwCoconut?: ((from: A['position'], target: A['position'], thrower: A) => void) | undefined };
}

export function pickPerch<A extends AnimalSim>(a: A, c: MonkeyPerchPorts<A>, minD: number, maxD: number, awayFrom?: A['position']): number {
  const P = c.world.perches; if (P === undefined || P.length === 0) return -1;
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (p === undefined) continue;
    const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    if (d < minD || d > maxD) continue;
    const taken = c.herd?.some((h) => h !== a && h.alive && h.mem['perch'] === i) ? 1 : 0;
    const away = awayFrom ? Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) : 0;
    const score = away * 0.5 - d * 0.3 - taken * 30 + c.rng.next() * 3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
export function setPerch<A extends AnimalSim>(a: A, c: MonkeyPerchPorts<A>, i: number): void {
  const m = a.mem as MonkeyMem;
  const p = c.world.perches?.[i];
  if (p === undefined) throw new Error(`monkey: no perch ${i}`);   // i came from pickPerch
  const base = c.world.perchBases?.[i] ?? p;
  m.perch = i; m.px = p.x; m.pz = p.z; m.bx = base.x; m.bz = base.z;
  m.perchH = Math.max(0.5, p.y - c.heightAt(p.x, p.z) + 0.05);
}

const _from = new Vector3(), _to = new Vector3();
function strikeMonkey<A extends AnimalSim>(a: A, c: MonkeyStrikePorts<A>): void {
  const m = a.mem as MonkeyMem, p = a.attackPhase;
  if (m.st !== ST_ATTACK || p < 0) return;
  if (m.bite) { if (p >= 0.45 && !m.hit) { m.hit = 1; if (driftwoodContact(a, c, DRIFTWOOD_STRIKES.bite)) c.sound('monkey_shriek'); } }
      else if (p >= THROW_RELEASE && !m.hit) {
        m.hit = 1;
        _from.set(a.position.x, a.position.y + 0.95 * a.scale, a.position.z);
        _to.set(c.player.x, c.player.y + 0.9, c.player.z);
        c.world.throwCoconut?.(_from, _to, a);
      }
}
const STATES = ['perch', 'ground-idle', 'attack', 'drop', 'ground', 'return', 'climb'] as const;
/** The monkey's brain shell: the selected decision (shipping or data-selected) at 10 Hz, the strike every body step. */
export class MonkeyBrain<A extends AnimalSim, C extends MonkeyStrikePorts<A>> extends CreatureBrain<typeof STATES[number], A, C> {
  private readonly decide: (actor: A, ctx: C) => void;
  constructor(actor: A, decide: (actor: A, ctx: C) => void) { super(actor, STATES); this.decide = decide; }
  override think(ctx: C): void {
    this.decide(this.actor, ctx);
    const state = STATES[this.actor.mem['st'] ?? 0];
    if (state !== undefined) this.transition(state);
  }
  override act(ctx: C): void { strikeMonkey(this.actor, ctx); }
}
