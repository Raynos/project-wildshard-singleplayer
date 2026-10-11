import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { bossFight } from '@wildshard/game/plugin/bossPhase';
import { moduleBytes, type EliteScriptLane as EliteScript } from '@wildshard/game/plugin/brain';
import { parseEliteScript } from '@wildshard/format/eliteScripts';
import { QARA_RULES, QARA_MODES, QARA_OPEN_CUE } from '../data/qaraBrain';
import { qaraBrain, QARA_MODULE } from './qaraBrain';

/** The actual night roster owns these actors, its kill counter and its line/arrow policy. */
export interface QaraCrew<A extends AnimalSim> {
  readonly killsTonight: number;
  readonly spawnLine: (count: 3) => readonly A[];
  readonly dissolve: (a: A) => void;
}
export interface QaraPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly awareRadius: number; readonly phase2: () => boolean; readonly heightAt: (x: number, z: number) => number;
  readonly crew: QaraCrew<A> | null; readonly resolve: (id: string) => A | null;
  readonly lane: { readonly setTime: (t: number) => void; readonly hide: () => void;
    readonly lane: (x0: number, z0: number, x1: number, z1: number, width: number, alpha: number) => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly feed: (text: string) => void; readonly sound: (cue: 'horse_squeal', at: Vector3) => void; readonly signature: () => void;
}
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['wait', 'circle', 'wheel', 'charge', 'open', 'home']), stT: finite, chargeT: finite,
  pairs: v.picklist([0, 1]), struck: v.boolean(), c0: triple, c1: triple, line: v.pipe(v.array(v.string()), v.maxLength(3)) });
const invalidLine = new Error('Invalid Qara companion line');
const invalidCommand = new Error('Invalid Qara script command');
/** Shipping night-captain policy. The real ghost roster supplies line/arrow ownership; this is not a replacement for it. */
export class QaraKeeper<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'wait';
  private readonly script: EliteScript;
  private readonly observations: number[] = Array.from({ length: 21 }, () => 0);
  private line: readonly A[] = [];
  private readonly c0 = new Vector3(); private readonly c1 = new Vector3();
  constructor(private readonly ports: QaraPorts<A>) {
    this.script = bossFight({ kind: 'boss', pattern: 'script', fight: parseEliteScript(qaraBrain(ports.lair)) },
      { bytes: moduleBytes(QARA_MODULE.bytes), random: () => { throw new Error('Qara has no random decisions'); } });
  }
  spawned(): void { this.st = 'wait'; }
  reset(): void { this.st = 'home'; this.ports.lane.hide(); }
  disposeLine(): void {
    this.ports.lane.hide();
    for (let i = 0; i < 3; i++) { const a = this.line[i]; if (a === undefined) break; if (a.alive) this.ports.crew?.dissolve(a); }
    this.line = [];
  }
  private melee(p: Vector3): boolean { const pl = this.ports.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < QARA_RULES.open.range; }
  canSpawn(): boolean { return this.ports.crew === null || this.ports.crew.killsTonight >= 5;   }
  damage(_a: A, p: Vector3): number { return this.st === 'open' && this.melee(p) ? QARA_RULES.open.damage : 1;   }
  think(a: A, c: { readonly player: Vector3 }): void {
    const m = a.mem, tx = m['tx'], tz = m['tz'];
    a.lookTarget.copy(c.player); a.lookWeight = 0.5;
    if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
    const dx = tx - a.position.x, dz = tz - a.position.z;
    a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : m['v'] ?? 9, m['turn'] ?? 2.4);
  }
  private drawLane(p: Vector3, alpha: number): void {
    const dx = p.x - this.c0.x, dz = p.z - this.c0.z, d = Math.hypot(dx, dz);
    if (d < QARA_RULES.lane.minimumLength) { this.ports.lane.hide(); return; }
    const k = (d - QARA_RULES.lane.shortOfPlayer) / d;
    this.ports.lane.lane(this.c0.x, this.c0.z, this.c0.x + dx * k, this.c0.z + dz * k, QARA_RULES.lane.width, alpha);
  }
  private lineDead(): boolean {
    for (let i = 0; i < 3; i++) if (this.line[i]?.alive === true) return false;
    return true;
  }
  private bindLine(members: readonly A[]): void {
    if (members.length > 3) throw invalidLine;
    for (let i = 0; i < 3; i++) {
      if (i >= members.length) break;
      const a = members[i];
      if (a === undefined) throw invalidLine;
      for (let j = 0; j < 3; j++) if (j < i && members[j]?.entityId === a.entityId) throw invalidLine;
    }
    this.line = members;
  }
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.lane.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'wait' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.ports.player.position) < this.ports.awareRadius * 0.8)) {
      this.st = 'circle'; this.script.setSlot('cooldown', QARA_RULES.engagedCooldown);
      // his riders ride with him and loose their volleys (B11's line AI)
      if (this.ports.crew !== null && this.lineDead()) this.bindLine(this.ports.crew.spawnLine(3));
    }
    const p = this.ports.player.position;
    // Native geometry observation: includes c0.y exactly as the shipping Vector3 denominator did.
    const along = ((a.position.x - this.c0.x) * (this.c1.x - this.c0.x) + (a.position.z - this.c0.z) * (this.c1.z - this.c0.z)) / Math.max(1, this.c0.distanceToSquared(this.c1));
    const input = this.observations;
    input[1] = dt; input[2] = t; input[3] = 1; input[4] = QARA_MODES.indexOf(this.st); input[5] = this.script.slot('clock');
    input[6] = this.ports.phase2() ? 1 : 0; input[7] = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    input[8] = Math.atan2(p.x - a.position.x, p.z - a.position.z); input[9] = p.x; input[10] = p.z;
    input[11] = a.position.x; input[12] = a.position.z; input[13] = a.seed; input[14] = Math.max(-1e9, a.lastHitT);
    input[19] = along; input[20] = this.st === 'charge' ? p.y - this.ports.heightAt(p.x, p.z) : 0;
    const answer = this.script.decide(input);
    if (answer === null) { a.setMotion(a.yaw, 0, 0); return; }
    for (let i = 0; i < 64; i++) {
      if (i >= answer.length) break;
      const command = answer[i]; if (command === undefined) throw invalidCommand;
      switch (command.verb) {
        case 1: { const mode = QARA_MODES[command.value]; if (mode === undefined) throw invalidCommand; this.st = mode; break; }
        // Keep native think cadence: the puppet reads these fields, rather than steering directly on every script frame.
        case 2: a.mem['v'] = Math.min(this.script.data.maxSpeed, Math.max(0, command.args[0])); a.mem['turn'] = Math.min(this.script.data.maxTurnRate, Math.max(0, command.args[1])); break;
        case 4:
          if (command.value === 0) this.ports.sound('horse_squeal', a.position);
          else if (command.value === 1) this.ports.feed(QARA_OPEN_CUE);
          else throw invalidCommand;
          break;
        case 5: this.ports.signature(); break;
        case 11: this.ports.lane.hide(); break;
        case 12: { const action = this.script.data.actions[command.value]; if (action === undefined) throw invalidCommand; this.action(a, action, command.args); break; }
        default: throw invalidCommand;
      }
    }
  }
  private action(a: A, action: string, args: readonly [number, number]): void {
    switch (action) {
      case 'target': a.mem['tx'] = args[0]; a.mem['tz'] = args[1]; break;
      case 'wheelEndpoint': this.c0.copy(a.position); this.c1.set(args[0], 0, args[1]); break;
      case 'chargeTarget': a.mem['tx'] = this.c1.x; a.mem['tz'] = this.c1.z; break;
      case 'openTarget':
        a.mem['tx'] = a.position.x + Math.sin(a.yaw) * args[0]; a.mem['tz'] = a.position.z + Math.cos(a.yaw) * args[0]; break;
      case 'drawLane': this.drawLane(this.ports.player.position, args[0]); break;
      case 'hit': this.ports.hurt(a, args[0]); this.ports.knock(this.c1.x - this.c0.x, this.c1.z - this.c0.z); break;
      default: throw invalidCommand;
    }
  }
  snapshot(): v.InferOutput<typeof Saved> { return v.parse(Saved, { st: this.st, stT: this.script.slot('clock'), chargeT: this.script.slot('cooldown'), pairs: this.script.slot('pairs'), struck: this.script.slot('struck') !== 0,
    c0: [this.c0.x, this.c0.y, this.c0.z], c1: [this.c1.x, this.c1.y, this.c1.z], line: this.line.map(a => a.entityId) }); }
  restore(input: unknown): void {
    const s = v.parse(Saved, input);
    if (new Set(s.line).size !== s.line.length) throw new Error('Duplicate Qara companion identity');
    const line = s.line.map(id => { const a = this.ports.resolve(id); if (a === null || a.entityId !== id) throw new Error('Missing Qara companion identity'); return a; });
    this.st = s.st; this.script.setSlot('clock', s.stT); this.script.setSlot('cooldown', s.chargeT); this.script.setSlot('pairs', s.pairs); this.script.setSlot('struck', s.struck ? 1 : 0);
    this.c0.fromArray(s.c0); this.c1.fromArray(s.c1); this.line = line;
  }
}
