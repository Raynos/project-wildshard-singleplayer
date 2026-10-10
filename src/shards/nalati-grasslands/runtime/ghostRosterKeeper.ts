import * as v from 'valibot';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { Vector3 } from 'three';

/** Body allocation, line steering and projectile flight have separate real owners. These are the roster's own clocks. */
export interface GhostRosterMember<A extends AnimalSim> {
  readonly a: A; readonly quiet: boolean;
  readonly line: { readonly mode: 'patrol' | 'engage' } | null;
  fade: number; fadeTarget: number; dying: number; fireT: number; dead: boolean;
}
export interface GhostRosterLine<A extends AnimalSim> { readonly riders: readonly GhostRosterMember<A>[] }
export interface GhostRosterPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 };
  readonly phase: () => string;
  readonly riders: GhostRosterMember<A>[];
  readonly lines: GhostRosterLine<A>[];
  readonly hidden: (a: A) => boolean;
  readonly random: () => number;
  readonly spawnLine: () => void;
  readonly steer: (line: GhostRosterLine<A>, dt: number) => void;
  readonly shoot: (r: GhostRosterMember<A>) => void;
  readonly retire: (r: GhostRosterMember<A>) => void;
  readonly killed: (a: A, killsTonight: number) => void;
  readonly arrows: (dt: number) => void;
}
const MAX = 64, finite = v.pipe(v.number(), v.finite());
const Row = v.strictObject({ id: v.string(), quiet: v.boolean(), fade: finite, fadeTarget: finite, dying: finite, fireT: finite, dead: v.boolean() });
const Saved = v.strictObject({ version: v.literal(1), hold: v.boolean(), freeze: v.boolean(),
  killsTonight: v.pipe(finite, v.integer(), v.minValue(0)), respawnT: finite,
  riders: v.pipe(v.array(Row), v.maxLength(MAX)), lines: v.pipe(v.array(v.pipe(v.array(v.strictObject({ id: v.string(), dead: v.boolean() })), v.maxLength(MAX))), v.maxLength(MAX)) });
const invalid = new Error('Incompatible ghost roster identities');

/** Shipping nightfall/attach clocks, reverse-order deaths, fades, volley timers and line retirement.
 * This does not stand in for body allocation, collision sockets or arrow flight; qualification requires all of them.
 * Cosmetic mist/material work stays in the view and consumes its separate cosmetic stream. */
export class GhostRosterKeeper<A extends AnimalSim> {
  hold = false; freeze = false; killsTonight = 0;
  private respawnT = -1;
  constructor(private readonly ports: GhostRosterPorts<A>) {}
  living(): number {
    let n = 0;
    for (let i = 0; i < MAX; i++) { const r = this.ports.riders[i]; if (r === undefined) break; if (!r.dead) n++; }
    return n;
  }
  /** Called on the real clock's night edge, never replayed by restore. */
  night(): void { this.killsTonight = 0; if (!this.hold && this.living() === 0) this.respawnT = 2; }
  attach(): void { if (this.ports.phase() === 'night') this.respawnT = 0.5; }
  dissolve(a: A): void {
    for (let i = 0; i < MAX; i++) {
      const r = this.ports.riders[i]; if (r === undefined) break;
      if (r.a === a) { if (r.dying === 0) { r.dying = 0.001; r.fadeTarget = 0; } return; }
    }
  }
  dawn(): void {
    for (let i = 0; i < MAX; i++) { const r = this.ports.riders[i]; if (r === undefined) break; this.dissolve(r.a); }
    this.respawnT = -1;
  }
  update(dt: number): void {
    const { riders, lines } = this.ports, p = this.ports.player.position;
    if (riders.length > MAX || lines.length > MAX) throw invalid;
    if (this.respawnT >= 0 && !this.hold) {
      this.respawnT -= dt;
      if (this.respawnT < 0 && this.ports.phase() === 'night') this.ports.spawnLine();
    }
    if (riders.length > MAX || lines.length > MAX) throw invalid;
    for (let i = 0; i < MAX; i++) { const line = lines[i]; if (line === undefined) break; this.ports.steer(line, dt); }
    if (this.freeze) for (let i = 0; i < MAX; i++) {
      const r = riders[i]; if (r === undefined) break; r.a.mem['tx'] = r.a.position.x; r.a.mem['tz'] = r.a.position.z; r.fireT = 99;
    }
    for (let i = 63; i >= 0; i--) {
      const r = riders[i]; if (r === undefined) continue;
      const a = r.a; a.mem['px'] = p.x; a.mem['pz'] = p.z;
      if (!a.alive && !r.dead) {
        r.dead = true; r.dying = Math.max(r.dying, 0.001); r.fadeTarget = 0;
        this.killsTonight++; this.ports.killed(a, this.killsTonight);
      }
      r.fade += (r.fadeTarget - r.fade) * Math.min(1, dt * (r.fadeTarget > r.fade ? 1.4 : 2.2));
      if (r.dying > 0) {
        r.dying += dt;
        if (r.dying >= 1.3) { this.ports.retire(r); riders.splice(i, 1); continue; }
      }
      if (r.dead || this.ports.hidden(a)) continue;
      r.fireT -= dt;
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      if (!r.quiet && r.fireT <= 0 && d < 62 && d > 6 && (r.line === null || r.line.mode === 'engage')) {
        this.ports.shoot(r); r.fireT = 3 + this.ports.random() * 1.8;
      }
    }
    for (let i = 63; i >= 0; i--) {
      const line = lines[i]; if (line === undefined) continue;
      if (line.riders.length > MAX) throw invalid;
      let empty = true;
      for (let j = 0; j < MAX; j++) {
        const r = line.riders[j]; if (r === undefined) break;
        if (!r.dead && !this.ports.hidden(r.a) && riders.includes(r)) { empty = false; break; }
      }
      if (empty) {
        lines.splice(i, 1);
        if (this.living() === 0 && this.ports.phase() === 'night') this.respawnT = 60;
      }
    }
    this.ports.arrows(dt);
  }
  snapshot(): v.InferOutput<typeof Saved> {
    return { version: 1, hold: this.hold, freeze: this.freeze, killsTonight: this.killsTonight, respawnT: this.respawnT,
      riders: this.ports.riders.map(r => ({ id: r.a.entityId, quiet: r.quiet, fade: r.fade, fadeTarget: r.fadeTarget, dying: r.dying, fireT: r.fireT, dead: r.dead })),
      lines: this.ports.lines.map(line => line.riders.map(r => ({ id: r.a.entityId, dead: r.dead }))) };
  }
  restore(input: unknown): void {
    const s = v.parse(Saved, input), { riders, lines } = this.ports;
    if (s.riders.length !== riders.length || s.lines.length !== lines.length || new Set(s.riders.map(r => r.id)).size !== s.riders.length) throw invalid;
    for (let i = 0; i < MAX; i++) {
      const row = s.riders[i]; if (row === undefined) break;
      const r = riders[i]; if (r === undefined || row.id !== r.a.entityId || row.quiet !== r.quiet) throw invalid;
    }
    for (let i = 0; i < MAX; i++) {
      const ids = s.lines[i]; if (ids === undefined) break;
      const line = lines[i]; if (line === undefined || ids.length !== line.riders.length || new Set(ids.map(row => row.id)).size !== ids.length) throw invalid;
      for (let j = 0; j < MAX; j++) {
        const row = ids[j]; if (row === undefined) break;
        if (line.riders[j]?.a.entityId !== row.id) throw invalid;
        const active = s.riders.find(r => r.id === row.id);
        if (active !== undefined && active.dead !== row.dead) throw invalid;
      }
    }
    this.hold = s.hold; this.freeze = s.freeze; this.killsTonight = s.killsTonight; this.respawnT = s.respawnT;
    for (let i = 0; i < MAX; i++) {
      const row = s.riders[i]; if (row === undefined) break; const r = riders[i]; if (r === undefined) throw invalid;
      r.fade = row.fade; r.fadeTarget = row.fadeTarget; r.dying = row.dying; r.fireT = row.fireT; r.dead = row.dead;
    }
    // A line keeps its dead member after the body owner retires it; preserve that reference's death flag too.
    for (let i = 0; i < MAX; i++) {
      const rows = s.lines[i]; if (rows === undefined) break;
      for (let j = 0; j < MAX; j++) { const row = rows[j]; if (row === undefined) break; const r = lines[i]?.riders[j]; if (r !== undefined) r.dead = row.dead; }
    }
  }
}
