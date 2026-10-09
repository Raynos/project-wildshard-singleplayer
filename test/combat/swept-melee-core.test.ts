import { describe, expect, it } from 'vitest';
import { SweptMeleeCore, sweptMoveDamage, type SweptMoves, type SweptTiming, type SwingTiming } from '../../src/engine/combat/sweptMeleeCore';
import { COMBO, HEAVY } from '../../src/game/weapons/starterMoves';
import { SWORD_IRON, SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';
import { fnv1a32 } from '../../src/engine/core/rng';

/**
 * Oracle: SweptMelee's inline swing clock before SF72 moved it to combat/sweptMeleeCore.ts (combat/view/SweptMelee.ts at
 * 4377aa1c3: tryFire, strikeMove, beginCharge, releaseHeavy and the head of update), transcribed with the view's side
 * effects reduced to a log. The core must take the same moves at the same ticks with the same windows and cooldowns.
 */
class InlineOracle<M extends SwingTiming> {
  move: M | null = null; swingT = 0; comboIdx = 0; lastSwingEnd = -1e9; cooldown = 0;
  heldPrev = false; charging = false; chargeT = 0; releaseQueued = false; chargePending = false; time = 0; queued = false;
  readonly log: string[] = [];
  constructor(private readonly mv: SweptMoves<M>, private readonly profile: SweptTiming, private readonly name: (move: M) => string) {}
  private consume(): boolean { const was = this.queued; this.queued = false; return was; }
  tryFire(enabled: boolean): void {
    if (!enabled || this.charging) return;
    if (this.move) { if (this.move !== this.mv.heavy && this.comboIdx < this.mv.combo.length) this.queued = true; return; }
    if (this.cooldown > 0) return;
    this.consume();
    if (this.comboIdx >= this.mv.combo.length || this.time - this.lastSwingEnd > this.profile.comboGap) this.comboIdx = 0;
    const next = this.mv.combo[this.comboIdx] ?? null; this.comboIdx++;
    if (next !== null) this.startSwing(next, true);
  }
  strikeMove(enabled: boolean, move: M, lunge: boolean): boolean {
    if (!enabled || this.charging || this.move !== null || this.cooldown > 0) return false;
    this.comboIdx = this.mv.combo.length; this.startSwing(move, lunge); return true;
  }
  private startSwing(move: M, lunge: boolean): void { this.move = move; this.swingT = 0; this.consume(); this.log.push(`start:${this.name(move)}:${lunge}`); }
  private beginCharge(): void { this.log.push('charge:0'); this.charging = true; this.chargeT = 0; this.releaseQueued = false; this.chargePending = false; this.comboIdx = 0; }
  private releaseHeavy(): void { this.log.push('charge:1'); this.charging = false; this.releaseQueued = false; this.comboIdx = 0; this.startSwing(this.mv.heavy, true); }
  setInactive(): void { this.move = null; this.charging = false; this.chargePending = false; this.releaseQueued = false; }
  update(dt: number, t: number, swingScale: number, held: boolean): { move: M | null; active: boolean } {
    this.time = t;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (held && !this.heldPrev) { if (this.move) this.chargePending = true; else this.beginCharge(); }
    if (!held && this.heldPrev) { this.chargePending = false; if (this.charging) { if (this.chargeT >= this.profile.heavyCharge) this.releaseHeavy(); else this.releaseQueued = true; } }
    this.heldPrev = held;
    if (this.charging) { this.chargeT += dt; if (this.releaseQueued && this.chargeT >= this.profile.heavyCharge) this.releaseHeavy(); }
    else if (this.chargePending && !this.move) this.beginCharge();
    let move = this.move;
    if (move) {
      this.swingT += dt / swingScale;
      const next = this.swingT >= move.slashEnd + this.profile.chainLag && this.comboIdx < this.mv.combo.length && this.consume() ? this.mv.combo[this.comboIdx++] : undefined;
      if (next !== undefined) { this.startSwing(next, true); move = this.move; }
      else if (this.swingT >= move.total) { this.move = move = null; this.lastSwingEnd = t; this.cooldown = this.profile.cooldown; }
    }
    return { move, active: move !== null && this.swingT >= move.windup && this.swingT <= move.slashEnd };
  }
  get charge(): number { return this.charging ? Math.min(1, Math.max(0, this.chargeT / this.profile.heavyCharge)) : 0; }
  get comboStep(): number { return this.comboIdx >= this.mv.combo.length || (this.move === null && this.time - this.lastSwingEnd > this.profile.comboGap) ? 1 : this.comboIdx + 1; }
}

/** a recorded input tape: per tick a tap, the heavy latch, a scripted outside strike and a holster, from a fixed stream */
function tape(seed: number, ticks: number): { tap: boolean; held: boolean; strike: boolean; holster: boolean; dt: number }[] {
  let s = seed >>> 0, held = false;
  const next = (): number => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
  return Array.from({ length: ticks }, (_, i) => {
    if (next() < 0.02) held = !held;
    return { tap: next() < 0.12, held, strike: next() < 0.004, holster: i % 1500 === 1499, dt: next() < 0.1 ? 1 / 30 : next() < 0.05 ? 0.004 : 1 / 60 };
  });
}

function run(profile: typeof SWORD_WOOD, seed: number, restoreAt: number | null): { hash: number; log: string[]; swings: number; heavies: number; damage: number } {
  const moves = { combo: COMBO, heavy: HEAVY }, name = (move: typeof HEAVY): string => move.name;
  const oracle = new InlineOracle(moves, profile, name);
  let queued = false; const log: string[] = [];
  const make = (): SweptMeleeCore<typeof HEAVY> => new SweptMeleeCore(moves, profile, { queue: () => { queued = true; }, consume: () => { const was = queued; queued = false; return was; } },
    { start: (move, lunge) => { log.push(`start:${name(move)}:${lunge}`); }, charge: (phase) => { log.push(`charge:${phase}`); } });
  let core = make(), t = 0, hash = 0, swings = 0, heavies = 0, damage = 0;
  // the sabre's pass is a move outside the set; the starter finisher stands in for an outside strike's timing
  const outside = { ...COMBO[2] ?? HEAVY, name: 'pass-left' as const };
  for (const [i, input] of tape(seed, 6000).entries()) {
    if (i === restoreAt && core.move !== outside) {
      const saved = structuredClone(core.snapshot());
      core = make(); core.restore(saved);
    }
    if (input.holster) { oracle.setInactive(); core.stop(); }
    if (input.tap) { oracle.tryFire(true); core.tryFire(); }
    if (input.strike) expect(core.strike(outside, false)).toBe(oracle.strikeMove(true, outside, false));
    t += input.dt;
    const want = oracle.update(input.dt, t, profile.swingScale, input.held), got = core.step(input.dt, t, profile.swingScale, input.held);
    expect(got.move).toBe(want.move); expect(got.active).toBe(want.active);
    expect(core.charge).toBe(oracle.charge); expect(core.comboStep).toBe(oracle.comboStep); expect(queued).toBe(oracle.queued);
    if (got.move !== null && core.swingTime === input.dt / profile.swingScale) {
      swings++; if (got.move === HEAVY) heavies++;
      damage += sweptMoveDamage(profile.damage, got.move, got.move === HEAVY, 1.5);
    }
    hash = fnv1a32(`${hash}:${got.move?.name ?? '-'}:${got.active}:${core.comboStep}:${core.charge}`);
  }
  expect(log).toEqual(oracle.log);
  return { hash, log, swings, heavies, damage };
}

describe('swept melee clock (SF72, renderer-free)', () => {
  it.each([['wood', SWORD_WOOD], ['iron', SWORD_IRON]] as const)('takes the inline clock\'s moves, windows, charge and cooldowns on a recorded tape (%s)', (_blade, profile) => {
    for (const seed of [1, 7, 0x9d2a]) {
      const result = run(profile, seed, null);
      expect(result.swings).toBeGreaterThan(100); expect(result.heavies).toBeGreaterThan(5);
      expect(result.log.filter((line) => line.startsWith('start:finisher')).length).toBeGreaterThan(5);
    }
  });
  it('continues exactly from a mid-tape snapshot', () => {
    for (const at of [500, 1777, 3001]) expect(run(SWORD_WOOD, 7, at)).toEqual(run(SWORD_WOOD, 7, null));
  });
  it('charges the heavy perk only on the heavy', () => {
    const slash = COMBO[0] ?? HEAVY;
    expect(sweptMoveDamage(12, slash, false, 2)).toBe(12 * slash.damage);
    expect(sweptMoveDamage(12, HEAVY, true, 2)).toBe(12 * HEAVY.damage * 2);
  });
});
