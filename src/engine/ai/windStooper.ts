import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '../entities/AnimalSim';

/** Real terrain, wind, altitude, shared random, head/contact and entered tell authority for a wind-borne stooper. */
export interface WindStooperPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly rock: { readonly x: number; readonly z: number; readonly top: number };
  readonly phase2: () => boolean; readonly heightAt: (x: number, z: number) => number;
  readonly wind: () => { readonly x: number; readonly z: number }; readonly random: () => number;
  readonly isHead: (a: A, p: Vector3) => boolean;
  readonly tell: { readonly setTime: (t: number) => void; readonly aim: (from: Vector3, to: Vector3, alpha: number) => void;
    readonly chevron: (point: Vector3 | null) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly grounded: () => void; readonly cry: (at: Vector3) => void; readonly signature: () => void;
}
const scalar = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(600));
const positive = v.pipe(scalar, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(positive, v.maxValue(40)), turn = v.pipe(scalar, v.maxValue(30)), fraction = v.pipe(scalar, v.maxValue(1));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9._:-]{0,127}$/u));
const Spec = v.pipe(v.strictObject({
  initialCooldown: scalar, lookTurn: turn,
  fields: v.strictObject({ altitude: field, smoothed: field, flap: field, fold: field, ground: field, bank: field }),
  cruise: v.strictObject({ home: scalar, homePhase2: scalar, player: scalar, playerPhase2: scalar, clearance: scalar, wave: scalar, waveFrequency: scalar, ease: positive }),
  orbit: v.strictObject({ windScale: scalar, ease: positive, radius: positive, speed, climbEase: positive, soarEase: positive, climbSpeed: speed, arrival: scalar }),
  pose: v.strictObject({ initialFlap: fraction, climbFlap: fraction, soarFlap: fraction, waveFlap: fraction, flapFrequency: scalar, bank: scalar, tellFlap: fraction, tellFold: fraction }),
  tell: v.strictObject({ seconds: positive, phase2Seconds: positive, targetHeight: scalar, alpha: fraction, alphaGrowth: fraction }),
  stoop: v.strictObject({ targetHeight: scalar, speed, arrival: scalar, alpha: fraction, range: positive, playerHeight: scalar, damage: scalar, climbHeight: scalar,
    cooldown: scalar, randomCooldown: scalar, phaseCooldown: scalar, phaseRandom: scalar }),
  ground: v.strictObject({ onScale: scalar, idleScale: scalar, seconds: positive, damage: scalar }),
}), v.check(s => new Set(Object.values(s.fields)).size === 6, 'Distinct altitude and pose fields'));
/** Strict declared orbit, wind, tell, stoop, weak-point and cooldown tuning. */
export type WindStooperSpec = v.InferOutput<typeof Spec>;
/** Validate and copy all tuning before a native actor can be mutated. */
export function readWindStooperSpec(input: unknown): WindStooperSpec { return v.parse(Spec, input); }

const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['soar', 'tell', 'stoop', 'ground', 'climb']), stT: finite, stoopT: finite,
  ang: finite, centre: triple, tgt: triple, overYou: v.boolean() });
/** Declared downwind orbit, telegraphed stoop and grounded punish law, driven by authoritative body/altitude ports. */
export class WindStooperBrain<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'soar';
  private stT = 0; private stoopT: number; private ang = 0;
  private readonly centre = new Vector3(); private readonly tgt = new Vector3();
  private readonly from = new Vector3(); private readonly delta = new Vector3();
  private overYou = false;
  private readonly spec: WindStooperSpec;
  private readonly ports: WindStooperPorts<A>;
  constructor(spec: WindStooperSpec, ports: WindStooperPorts<A>) { this.ports = ports; this.spec = readWindStooperSpec(spec); this.stoopT = this.spec.initialCooldown; }
  private get p2(): boolean { return this.ports.phase2(); }
  /** Return to the climb phase without resetting retained clocks. */
  reset(): void { this.st = 'climb'; this.ports.tell.hide(); }
  /** Release transient entered tells without changing the body law. */
  disposeTell(): void { this.ports.tell.hide(); this.ports.tell.chevron(null); }
  private cruise(a: A | null): number {
    if (!this.overYou) return this.ports.rock.top + (this.p2 ? this.spec.cruise.homePhase2 : this.spec.cruise.home);
    // over you — but never inside the rock's flank the orbit swings across: 18 m clear of the ground under him
    const over = a !== null ? this.ports.heightAt(a.position.x, a.position.z) + this.spec.cruise.clearance : -Infinity;
    return Math.max(this.ports.player.position.y + (this.p2 ? this.spec.cruise.playerPhase2 : this.spec.cruise.player), over);
  }
  /** Initialize a real deferred body at its declared home altitude. */
  spawned(a: A): void {
    this.centre.set(this.ports.rock.x, 0, this.ports.rock.z);
    a.mem[this.spec.fields.altitude] = this.cruise(a); a.mem[this.spec.fields.flap] = this.spec.pose.initialFlap;
    this.st = 'soar'; this.stoopT = this.spec.initialCooldown;
  }
  /** Resolve the grounded weak point with the authoritative head query. */
  damage(a: A, p: Vector3): number {
    if (this.st === 'ground') return this.ports.isHead(a, p) ? 1 : this.spec.ground.damage;       // grounded: every hit a headshot
    return 1;
  }
  /** Preserve the manager decision cadence without taking frame motion authority. */
  think(a: A, c: { readonly player: Vector3 }): void { a.lookTarget.copy(c.player); a.lookWeight = 1; a.setMotion(a.yaw, 0, this.spec.lookTurn); }
  /** Advance the frame law; query actual terrain, wind and shared random only on their original frames. */
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    const wind = this.ports.wind();
    this.ports.tell.setTime(t);
    this.stT += dt;
    const p = this.ports.player.position, m = a.mem;
    // the orbit centre: over you while engaged, back over the rock otherwise; always drifting downwind
    const home = leashing || !engaged;
    this.overYou = !home;
    const cx = home ? this.ports.rock.x : p.x, cz = home ? this.ports.rock.z : p.z;
    this.centre.x += (cx + wind.x * this.spec.orbit.windScale - this.centre.x) * Math.min(1, dt * this.spec.orbit.ease);
    this.centre.z += (cz + wind.z * this.spec.orbit.windScale - this.centre.z) * Math.min(1, dt * this.spec.orbit.ease);
    const R = this.spec.orbit.radius;
    switch (this.st) {
      case 'soar': case 'climb': {
        this.ang += dt * this.spec.orbit.speed / R;
        const tx = this.centre.x + Math.cos(this.ang) * R, tz = this.centre.z + Math.sin(this.ang) * R;
        const k = this.st === 'climb' ? this.spec.orbit.climbEase : this.spec.orbit.soarEase;
        a.position.x += (tx - a.position.x) * Math.min(1, dt * k); a.position.z += (tz - a.position.z) * Math.min(1, dt * k);
        a.yaw = a.desiredYaw = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang));
        const cruise = this.cruise(a);
        const alt = m[this.spec.fields.altitude] ?? cruise;
        m[this.spec.fields.altitude] = this.st === 'climb' ? Math.min(cruise, alt + this.spec.orbit.climbSpeed * dt) : alt + (cruise + this.spec.cruise.wave * Math.sin(t * this.spec.cruise.waveFrequency) - alt) * Math.min(1, dt * this.spec.cruise.ease);
        m[this.spec.fields.flap] = this.st === 'climb' ? this.spec.pose.climbFlap : this.spec.pose.soarFlap + this.spec.pose.waveFlap * Math.max(0, Math.sin(t * this.spec.pose.flapFrequency)); m[this.spec.fields.fold] = 0; m[this.spec.fields.ground] = 0; m[this.spec.fields.bank] = this.spec.pose.bank;
        if (this.st === 'climb' && (m[this.spec.fields.altitude] ?? 0) >= cruise - this.spec.orbit.arrival) this.st = 'soar';
        if (engaged && this.st === 'soar') { this.stoopT -= dt; if (this.stoopT <= 0) { this.st = 'tell'; this.stT = 0; this.ports.signature(); this.ports.cry(a.position); } }
        break;
    }
      case 'tell': {
        // hangs on the wind, wings half folding; a gold line streaks from it to you, the chevron at the screen edge
        const T = this.p2 ? this.spec.tell.phase2Seconds : this.spec.tell.seconds;
        m[this.spec.fields.flap] = this.spec.pose.tellFlap; m[this.spec.fields.fold] = this.spec.pose.tellFold * (this.stT / T); m[this.spec.fields.bank] = 0;
        a.yaw = a.desiredYaw = Math.atan2(p.x - a.position.x, p.z - a.position.z);
        a.headWorld(this.from);
        this.delta.set(p.x, p.y + this.spec.tell.targetHeight, p.z);
        this.ports.tell.aim(this.from, this.delta, this.spec.tell.alpha + this.spec.tell.alphaGrowth * (this.stT / T));
        this.ports.tell.chevron(this.from);
        if (this.stT >= T) { this.st = 'stoop'; this.stT = 0; this.tgt.set(p.x, p.y + this.spec.stoop.targetHeight, p.z); }
        break;
    }
      case 'stoop': {
        m[this.spec.fields.fold] = 1; m[this.spec.fields.flap] = 0;
        this.from.set(a.position.x, m[this.spec.fields.altitude] ?? 0, a.position.z);
        this.delta.copy(this.tgt).sub(this.from);
        const L = this.delta.length(), step = this.spec.stoop.speed * dt;
        this.ports.tell.aim(this.from, this.tgt, this.spec.stoop.alpha);
        this.ports.tell.chevron(this.from);
        if (L <= step + this.spec.stoop.arrival) {
          this.ports.tell.hide(); this.ports.tell.chevron(null);
          a.position.x = this.tgt.x; a.position.z = this.tgt.z;
          if (Math.hypot(p.x - this.tgt.x, p.z - this.tgt.z) < this.spec.stoop.range && p.y - this.ports.heightAt(p.x, p.z) < this.spec.stoop.playerHeight) {
            this.ports.hurt(a, this.spec.stoop.damage); this.ports.knock(p.x - this.from.x, p.z - this.from.z);
            this.st = 'climb'; m[this.spec.fields.altitude] = this.tgt.y + this.spec.stoop.climbHeight;
          } else { this.st = 'ground'; this.stT = 0; m[this.spec.fields.altitude] = this.ports.heightAt(a.position.x, a.position.z) + this.spec.ground.onScale * a.scale; this.ports.grounded(); }
          this.stoopT = this.p2 ? this.spec.stoop.phaseCooldown + this.ports.random() * this.spec.stoop.phaseRandom : this.spec.stoop.cooldown + this.ports.random() * this.spec.stoop.randomCooldown;
        } else {
          this.delta.multiplyScalar(step / L);
          a.position.x += this.delta.x; a.position.z += this.delta.z; const altitude = (m[this.spec.fields.altitude] ?? 0) + this.delta.y; m[this.spec.fields.altitude] = altitude; m[this.spec.fields.smoothed] = altitude;
          a.yaw = a.desiredYaw = Math.atan2(this.delta.x, this.delta.z);
      }
        break;
    }
      case 'ground': {
        m[this.spec.fields.ground] = 1; m[this.spec.fields.fold] = 0; m[this.spec.fields.flap] = 0;
        m[this.spec.fields.altitude] = this.ports.heightAt(a.position.x, a.position.z) + this.spec.ground.idleScale * a.scale;
        if (this.stT > this.spec.ground.seconds) { this.st = 'climb'; m[this.spec.fields.ground] = 0; }
        break;
    }
      default: break;
  }
    if (this.st !== 'tell' && this.st !== 'stoop') { this.ports.tell.hide(); this.ports.tell.chevron(null); }
  }
  /** Capture every custom clock and fixed target without events or draws. */
  snapshot(): v.InferOutput<typeof Saved> { return { st: this.st, stT: this.stT, stoopT: this.stoopT, ang: this.ang, centre: [this.centre.x, this.centre.y, this.centre.z], tgt: [this.tgt.x, this.tgt.y, this.tgt.z], overYou: this.overYou }; }
  /** Validate the complete continuation atomically before mutation. */
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.stT = s.stT; this.stoopT = s.stoopT; this.ang = s.ang; this.centre.fromArray(s.centre); this.tgt.fromArray(s.tgt); this.overYou = s.overYou; }
}
