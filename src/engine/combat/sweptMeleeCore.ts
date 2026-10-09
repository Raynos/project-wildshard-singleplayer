/**
 * The swept melee family's swing clock, renderer-free (SF72): which move a tap throws (the light combo, its gap and its
 * one-deep chain), the held heavy's charge and release, the running swing's clock and active window, the cooldown after a
 * swing, and each move's damage. The browser's `SweptMelee` (combat/view/SweptMelee.ts) drives one of these for every
 * sword, sabre and jian and adds only presentation (pose, trail, lunge, sweep rays, FX); a headless runtime drives the
 * same clock from tick commands, so both run one implementation.
 *
 *   const clock = new SweptMeleeCore(moves, profile, { queue, consume }, { start: (move) => …, charge: (phase) => … });
 *   clock.tryFire();                    // a light tap
 *   clock.hold(true); clock.hold(false) // the heavy latch
 *   const { active } = clock.step(dt, t, profile.swingScale);
 */

/** The part of a move the clock reads: its windup, the end of its active window, its length and its damage factor. */
export interface SwingTiming {
  readonly windup: number;
  readonly slashEnd: number;
  readonly total: number;
  readonly damage: number;
}
/** The light combo in order and the charged heavy. */
export interface SweptMoves<M extends SwingTiming> {
  readonly combo: readonly M[];
  readonly heavy: M;
}
/** The profile's clock numbers (meleeProfile.ts), read live each step. */
export interface SweptTiming {
  readonly cooldown: number;
  readonly comboGap: number;
  readonly chainLag: number;
  readonly heavyCharge: number;
}
/** The one-deep queued tap (the browser's `app.input` 'attack' queue; a headless runtime keeps its own flag). */
export interface AttackQueue {
  readonly queue: () => void;
  readonly consume: () => boolean;
}
/** Reactions owned by the caller: a swing started (with whether it may lunge), the heavy's charge began (0) or released (1). */
export interface SweptEvents<M extends SwingTiming> {
  readonly start: (move: M, lunge: boolean) => void;
  readonly charge: (phase: 0 | 1) => void;
}
/** One step's outcome: the running move (after any chain) and whether its active window is open. */
export interface SweptStep<M extends SwingTiming> {
  readonly move: M | null;
  readonly active: boolean;
}
/** The clock's exact continuation; `move` indexes `[...combo, heavy]` (null: idle). */
export interface SweptMeleeState {
  readonly move: number | null;
  readonly swingT: number;
  readonly comboIdx: number;
  readonly lastSwingEnd: number;
  readonly cooldown: number;
  readonly charging: boolean;
  readonly chargeT: number;
  readonly releaseQueued: boolean;
  readonly chargePending: boolean;
  readonly heldPrev: boolean;
  readonly time: number;
}

/** A move's damage: the base × the move's factor, the heavy × `heavyMult` (a perk). */
export function sweptMoveDamage(base: number, move: SwingTiming, heavy: boolean, heavyMult: number): number {
  return base * move.damage * (heavy ? heavyMult : 1);
}

/** The swept melee family's swing / combo / heavy clock; see the module comment. */
export class SweptMeleeCore<M extends SwingTiming> {
  private readonly moves: SweptMoves<M>;
  private readonly timing: SweptTiming;
  private readonly attack: AttackQueue;
  private readonly events: SweptEvents<M>;
  private current: M | null = null;
  private swingT = 0;
  /** index into the combo of the NEXT light swing */
  private comboIdx = 0;
  private lastSwingEnd = -1e9;
  private cooldown = 0;
  private charging = false;
  private chargeT = 0;
  private releaseQueued = false;
  private chargePending = false;
  private heldPrev = false;
  private time = 0;

  constructor(moves: SweptMoves<M>, timing: SweptTiming, attack: AttackQueue, events: SweptEvents<M>) {
    this.moves = moves; this.timing = timing; this.attack = attack; this.events = events;
  }

  /** the running swing, or null */
  get move(): M | null { return this.current; }
  /** seconds into the running swing (world-scaled, ÷ swingScale) */
  get swingTime(): number { return this.swingT; }
  /** true while the heavy is being charged */
  get chargingHeavy(): boolean { return this.charging; }
  /** 0..1 heavy charge (1 = ready to release) */
  get charge(): number { return this.charging ? Math.min(1, Math.max(0, this.chargeT / this.timing.heavyCharge)) : 0; }
  /** which light swing the next tap throws (1-based) */
  get comboStep(): number {
    return this.comboIdx >= this.moves.combo.length || (this.current === null && this.time - this.lastSwingEnd > this.timing.comboGap) ? 1 : this.comboIdx + 1;
  }
  /** the move the input picks: the heavy, or the next combo swing */
  pick(input: 'attack' | 'heavy'): M | null { return input === 'heavy' ? this.moves.heavy : this.moves.combo[this.comboIdx] ?? null; }

  /**
   * A light tap. Idle → the next combo swing (the first again past `comboGap` or once the combo is spent). Mid-swing →
   * queues the next combo swing (one deep; not off the heavy). Ignored while charging or cooling.
   */
  tryFire(pick: (input: 'attack' | 'heavy') => M | null = (input) => this.pick(input)): void {
    if (this.charging) return;
    if (this.current !== null) {
      if (this.current !== this.moves.heavy && this.comboIdx < this.moves.combo.length) this.attack.queue();
      return;
    }
    if (this.cooldown > 0) return;
    this.attack.consume();
    if (this.comboIdx >= this.moves.combo.length || this.time - this.lastSwingEnd > this.timing.comboGap) this.comboIdx = 0;
    const next = pick('attack'); this.comboIdx++;
    if (next !== null) this.start(next, true);
  }
  /** start one specific move outside the combo (ends the combo): false while a swing, a charge or the cooldown runs */
  strike(move: M, lunge = true): boolean {
    if (this.charging || this.current !== null || this.cooldown > 0) return false;
    this.comboIdx = this.moves.combo.length;
    this.start(move, lunge);
    return true;
  }
  /** holstered / disabled: the swing and any charge stop */
  stop(): void { this.current = null; this.charging = false; this.chargePending = false; this.releaseQueued = false; }

  /**
   * One step: the cooldown, the heavy latch's edges (`held`: on = charge after the running swing, off = release when
   * charged, else when it charges), the swing clock (a queued tap chains once the active window closes + `chainLag`; the
   * swing's end starts the cooldown). `t` is the world clock the combo gap is measured on.
   */
  step(dt: number, t: number, swingScale: number, held: boolean, pick: (input: 'attack' | 'heavy') => M | null = (input) => this.pick(input)): SweptStep<M> {
    this.time = t;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (held && !this.heldPrev) { if (this.current !== null) this.chargePending = true; else this.beginCharge(); }
    if (!held && this.heldPrev) { this.chargePending = false; if (this.charging) { if (this.chargeT >= this.timing.heavyCharge) this.releaseHeavy(pick); else this.releaseQueued = true; } }
    this.heldPrev = held;
    if (this.charging) {
      this.chargeT += dt;
      if (this.releaseQueued && this.chargeT >= this.timing.heavyCharge) this.releaseHeavy(pick);
    } else if (this.chargePending && this.current === null) this.beginCharge();
    let move = this.current;
    if (move !== null) {
      this.swingT += dt / swingScale;
      const next = this.swingT >= move.slashEnd + this.timing.chainLag && this.comboIdx < this.moves.combo.length && this.attack.consume() ? this.moves.combo[this.comboIdx++] : undefined;
      if (next !== undefined) { this.start(next, true); move = this.current; }
      else if (this.swingT >= move.total) { this.current = move = null; this.lastSwingEnd = t; this.cooldown = this.timing.cooldown; }
    }
    return { move, active: move !== null && this.swingT >= move.windup && this.swingT <= move.slashEnd };
  }

  /** the exact continuation (a move outside the combo / heavy cannot be saved: it refuses) */
  snapshot(): SweptMeleeState {
    const all = [...this.moves.combo, this.moves.heavy], index = this.current === null ? null : all.indexOf(this.current);
    if (index === -1) throw new Error('A swept swing outside its move set has no continuation');
    return { move: index, swingT: this.swingT, comboIdx: this.comboIdx, lastSwingEnd: this.lastSwingEnd, cooldown: this.cooldown, charging: this.charging,
      chargeT: this.chargeT, releaseQueued: this.releaseQueued, chargePending: this.chargePending, heldPrev: this.heldPrev, time: this.time };
  }
  restore(state: SweptMeleeState): void {
    const all = [...this.moves.combo, this.moves.heavy], move = state.move === null ? null : all[state.move];
    if (move === undefined) throw new Error('Invalid swept swing continuation');
    this.current = move; this.swingT = state.swingT; this.comboIdx = state.comboIdx; this.lastSwingEnd = state.lastSwingEnd; this.cooldown = state.cooldown;
    this.charging = state.charging; this.chargeT = state.chargeT; this.releaseQueued = state.releaseQueued; this.chargePending = state.chargePending;
    this.heldPrev = state.heldPrev; this.time = state.time;
  }

  private start(move: M, lunge: boolean): void {
    this.current = move; this.swingT = 0; this.attack.consume();
    this.events.start(move, lunge);
  }
  private beginCharge(): void {
    this.events.charge(0); this.charging = true; this.chargeT = 0; this.releaseQueued = false; this.chargePending = false; this.comboIdx = 0;
  }
  private releaseHeavy(pick: (input: 'attack' | 'heavy') => M | null): void {
    this.events.charge(1); this.charging = false; this.releaseQueued = false; this.comboIdx = 0;
    const move = pick('heavy'); if (move !== null) this.start(move, true);
  }
}
