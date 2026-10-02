import { CreatureBrain, StrikeRunner, type Animal, type SpeciesLook, type SpeciesRow, type StrikeContext, type StrikeSpec, type ThinkCtx } from '#engine';
import { Vector3 } from 'three';
import { BASIN } from '../layout';
import { STRINGS } from '../strings';
import { DUNE_RAY_LOOK, rayGeometry } from './duneRay';

/**
 * The Dune Matriarch's numbers. `mem.phase` (0 dives, 1 storm, 2 grounded) and `mem.fight` (1 while the boss fight
 * runs) are written by the boss script (`combat/matriarch.ts`); `mem.rise` (0 → 1) by its intro.
 */
export const MATRIARCH = { circleR: 30, alt: 18, stormAlt: 24, speed: 12, diveSpeed: 19, every: [5, 3.2, 0], climbFor: 2.4, crawl: 2.2, groundAlt: 0.9,
  /** Grounded she lies on the sand (`lieAlt`) and holds `standOff` m from the player (her centre): at 3.6× her nose is 6.4 m
   * ahead of it, so she fills the lower half of the view and the lash (7 m) still lands on her head and back. */
  lieAlt: 0.2, standOff: 9 } as const;
export const MATRIARCH_HP = 600;
/** Her dive: a wide sphere swoop; in the storm she dives more often. */
export const MAW: StrikeSpec = { id: 'sunscar.matriarch.dive', shape: { kind: 'sphere', radius: 4 }, windup: 0.35, active: 0.5, recover: 0.6, cooldown: 2,
  range: 10, damage: 18, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };
/**
 * Grounded: a tail sweep all round her (telegraphed by the tail lifting; her tail reaches 11.5 m) and a forward wing
 * buffet. World metres: actor units would scale them by 3.6, a 25 m ring the player could not leave.
 */
export const TAIL_SWEEP: StrikeSpec = { id: 'sunscar.matriarch.tail', shape: { kind: 'ring', inner: 0, outer: 12 }, windup: 1.0, active: 0.25, recover: 1.0, cooldown: 4,
  range: 11.5, damage: 16, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 2 };
export const BUFFET: StrikeSpec = { id: 'sunscar.matriarch.buffet', shape: { kind: 'arc', radius: 11, halfAngle: 0.8 }, windup: 0.7, active: 0.2, recover: 0.8, cooldown: 2.2,
  range: 10.5, damage: 12, tags: ['creature.duneMatriarch'], units: 'world', weight: () => 1 };

type MatriarchState = 'circle' | 'dive' | 'climb' | 'grounded';
export class MatriarchBrain extends CreatureBrain<MatriarchState> {
  private readonly strikes = new StrikeRunner();
  private readonly chest = new Vector3();
  private clock = 0; private wait = 3; private struck = false;
  constructor(actor: Animal) { super(actor, ['circle', 'dive', 'climb', 'grounded']); }
  private context(ctx: ThinkCtx, target: Vector3): StrikeContext {
    const a = this.actor; return { actor: a, target, canReach: () => ctx.reach(a), hit: (spec) => { this.struck = true; ctx.hurt(spec.damage); } };
  }
  override think(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive || (a.mem['fight'] ?? 0) < 1) return;
    const phase = a.mem['phase'] ?? 0;
    if (phase >= 2 && this.state !== 'grounded') { this.transition('grounded'); this.strikes.cancel(); return; }
    if (this.state === 'grounded' && !this.strikes.busy) {
      const pick = this.strikes.pick([TAIL_SWEEP, BUFFET], this.context(ctx, ctx.player)); if (pick && ctx.claim(a)) this.strikes.start(pick, a, ctx.player);
    }
    if (this.state === 'circle' && this.wait <= 0 && ctx.claim(a)) { this.transition('dive'); this.clock = 0; this.struck = false; }
  }
  override act(ctx: ThinkCtx): void {
    const a = this.actor; if (!a.alive) return;
    const fight = (a.mem['fight'] ?? 0) >= 1, phase = a.mem['phase'] ?? 0, rise = a.mem['rise'] ?? 1;
    this.clock += ctx.dt; this.wait -= ctx.dt;
    const toYaw = (x: number, z: number): number => Math.atan2(x - a.position.x, z - a.position.z);
    if (!fight) {
      // Dormant or rising: hold over the basin's heart, climbing as the intro lifts her.
      ctx.flight.steer(a, a.yaw + 0.4, rise > 0 ? 3 : 0, MATRIARCH.groundAlt + (MATRIARCH.alt - MATRIARCH.groundAlt) * rise, 0.6); return;
    }
    if (this.state === 'grounded') {
      const target = this.context(ctx, ctx.player); this.strikes.update(ctx.dt, target);
      const d = Math.hypot(ctx.player.x - a.position.x, ctx.player.z - a.position.z);
      ctx.flight.steer(a, toYaw(ctx.player.x, ctx.player.z), this.strikes.busy || d < MATRIARCH.standOff ? 0 : MATRIARCH.crawl, MATRIARCH.lieAlt, 1.2); return;
    }
    this.chest.copy(ctx.player); this.chest.y += 1.2;
    const strike = this.context(ctx, this.chest); this.strikes.update(ctx.dt, strike);
    const high = phase === 1 ? MATRIARCH.stormAlt : MATRIARCH.alt;
    if (this.state === 'dive') {
      const d3 = a.position.distanceTo(this.chest);
      ctx.flight.steer(a, toYaw(this.chest.x, this.chest.z), MATRIARCH.diveSpeed, Math.max(1.6, Math.min(high, d3 * 0.4)), 2.4);
      if (!this.strikes.busy && !this.struck) { const next = this.strikes.pick([MAW], strike); if (next !== null) this.strikes.start(next, a, this.chest); }
      if ((this.struck && !this.strikes.busy) || this.clock > 5.5) { this.transition('climb'); this.clock = 0; }
      return;
    }
    if (this.state === 'climb') {
      ctx.flight.steer(a, a.yaw, MATRIARCH.speed + 3, high, 1);
      if (this.clock > MATRIARCH.climbFor) { this.transition('circle'); this.wait = MATRIARCH.every[phase] ?? 4; }
      return;
    }
    // Circle the basin's heart.
    const around = Math.atan2(a.position.x - BASIN.x, a.position.z - BASIN.z) + 0.5;
    ctx.flight.steer(a, toYaw(BASIN.x + Math.sin(around) * MATRIARCH.circleR, BASIN.z + Math.cos(around) * MATRIARCH.circleR), MATRIARCH.speed, high, 1.1);
  }
}
const brains = new WeakMap<Animal, MatriarchBrain>();
const brain = (a: Animal): MatriarchBrain => { let value = brains.get(a); if (!value) { value = new MatriarchBrain(a); brains.set(a, value); } return value; };

export const DUNE_MATRIARCH: SpeciesRow = { id: 'sunscar.creature.duneMatriarch', kind: 'duneMatriarch', label: STRINGS.matriarch, aggressive: true, lockable: true, blood: false,
  // She is huge and circles the bowl far out: lock from 60 m (sol-lock).
  flight: { altitude: MATRIARCH.alt, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 },
  variants: [{ id: 'matriarch', label: STRINGS.matriarch, weight: 1, rarity: 'legendary', scale: [3.6, 3.6], hp: MATRIARCH_HP }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };

/** The ray's own body at 3.6×, slower wingbeats; grounded, the wings drape on the sand, the head dips and the tail lifts to sweep. */
export const DUNE_MATRIARCH_LOOK: SpeciesLook = { ...DUNE_RAY_LOOK, id: 'sunscar.look.duneMatriarch', species: DUNE_MATRIARCH.id, kind: 'duneMatriarch',
  rigContract: { ...DUNE_RAY_LOOK.rigContract, skeleton: 'sunscar.duneMatriarch' },
  build: (variant, rng) => ({ ...DUNE_RAY_LOOK.build(variant, rng), hardParts: [rayGeometry()] }),
  animate: ({ bones, t, alive, attack, mem }) => {
    const grounded = (mem['phase'] ?? 0) >= 2, flap = !alive ? -0.4 : grounded ? -0.14 + Math.sin(t * 1.1) * 0.06 + (attack >= 0 ? -attack * 0.4 : 0) : Math.sin(t * 1.5) * 0.34;
    const left = bones['wingL'], right = bones['wingR'], tail = bones['tail'], head = bones['head'];
    if (head) head.rotation.x = alive && grounded ? 0.22 : 0;
    if (left) left.rotation.z = -flap; if (right) right.rotation.z = flap;
    if (tail) { tail.rotation.y = alive ? Math.sin(t * (grounded ? 0.9 : 1.2)) * 0.3 : 0; tail.rotation.x = alive && grounded && attack >= 0 ? -attack * 0.7 : 0; }
  },
};
