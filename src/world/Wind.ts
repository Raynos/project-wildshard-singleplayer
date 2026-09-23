import * as THREE from 'three';
import { windUniforms } from './TreeFactory';

/**
 * The one wind of the world (Nalati: grass, arrows, clouds, flags, smoke, trees, storms).
 *
 *   import { wind } from './Wind';
 *   wind.speed            // m/s, the smoothed base speed (the WIND chip reads this)
 *   wind.dir              // radians, the heading the wind blows TOWARD, in the Player.yaw convention
 *                         //   (forward = (−sin yaw, 0, −cos yaw)), so `wind.dir − player.yaw` is the chip arrow
 *   wind.dirX / dirZ      // the same as a unit XZ vector
 *   wind.at(x, z, t?)     // m/s at a point incl. gusts (t = wind.time by default; a later t extrapolates)
 *   wind.vecAt(x, z, out) // the wind velocity {x, z} m/s at a point incl. gusts (arrow / javelin drift)
 *   wind.gustAt(x, z)     // the gust field 0..1 (the same number the grass shader bends by)
 *   wind.setTarget(speed, dir, gustiness?, seconds?)   // weather: ease toward a new wind
 *   wind.uniforms + WIND_GLSL                          // for any shader that wants the same gust field
 *
 * The gust field is a set of fronts travelling downwind (`travel` integrates speed × dt, so a speed change
 * never makes the pattern jump), bent across their length and patchy along it: visible bands of pushed grass
 * rolling across the hills 30–60 m ahead. The CPU copy (`gustAt`) and the GLSL copy (`windGust`) are the same
 * math, so an arrow feels the gust the player sees in the grass.
 *
 * Without a target the wind wanders on its own (a slow ±20 % breathing in speed, ±0.2 rad in heading) around
 * the last target. `update(dt)` is called once a frame by whoever owns the frame loop for the shard (the
 * painterly grass does it); it also bridges the legacy `windUniforms.uWindStrength` (TreeFactory) so trees and
 * undergrowth sway with the same strength. Nothing calls `update` on Pine Hollow / Driftwood, so they keep
 * their fixed wind.
 */

/** metres per second that equals the old `uWindStrength = 1` (Pine Hollow's calm day) */
const REF_SPEED = 5;

export const WIND_GLSL = /* glsl */`
uniform vec2 uWindDir;      // unit, the heading the wind blows toward (world xz)
uniform float uWindSpeed;   // m/s base
uniform float uWindGustiness; // 0..1
uniform float uWindTravel;  // m, how far the gust pattern has moved downwind
uniform float uWindTime;    // s
float windGust( vec2 p ) {
  vec2 perp = vec2( - uWindDir.y, uWindDir.x );
  float s = dot( p, uWindDir ) - uWindTravel;
  float c = dot( p, perp );
  float w1 = sin( s * 0.165 + sin( c * 0.045 + 1.3 ) * 1.8 + sin( c * 0.013 ) * 2.5 );
  float f1 = 0.5 + 0.5 * w1; f1 = f1 * f1 * f1;
  float m = 0.55 + 0.45 * sin( c * 0.031 + s * 0.021 + 0.7 );
  float w2 = sin( s * 0.39 + c * 0.11 + 2.1 );
  return clamp( f1 * m + 0.18 * ( 0.5 + 0.5 * w2 ), 0.0, 1.0 );
}
`;

export class Wind {
  /** m/s, smoothed base speed (no gusts) */
  speed = 5;
  /** radians, heading the wind blows toward (Player.yaw convention) */
  dir = 1.95; // from the WSW (the Ili valley), toward the ENE — Nalati's prevailing westerly
  dirX = -Math.sin(1.95);
  dirZ = -Math.cos(1.95);
  /** 0..1, how strongly the gust fronts add to the base speed */
  gustiness = 0.6;
  /** seconds since start */
  time = 0;
  /** metres the gust pattern has travelled downwind */
  travel = 0;
  /** set false to freeze the self-wander (a scripted storm phase, a test) */
  wander = true;

  readonly uniforms = {
    uWindDir: { value: new THREE.Vector2(this.dirX, this.dirZ) },
    uWindSpeed: { value: this.speed },
    uWindGustiness: { value: this.gustiness },
    uWindTravel: { value: 0 },
    uWindTime: { value: 0 },
  };

  private target = { speed: 5, dir: 1.95, gustiness: 0.6, rate: 1 / 8 };
  /** the unwandered base heading / speed the smoothing converges on */
  private baseSpeed = 5;
  private baseDir = 1.95;

  /** Ease toward a new wind over ~`seconds` (weather, storms, a dev switch). */
  setTarget(speed: number, dir: number, gustiness = this.target.gustiness, seconds = 8): void {
    this.target.speed = Math.max(0, speed);
    this.target.dir = dir;
    this.target.gustiness = Math.min(1, Math.max(0, gustiness));
    this.target.rate = 1 / Math.max(0.05, seconds);
  }

  /** Jump straight to a wind (spawn, `?wind=` dev param). */
  set(speed: number, dir: number, gustiness = this.gustiness): void {
    this.setTarget(speed, dir, gustiness);
    this.baseSpeed = this.speed = this.target.speed;
    this.baseDir = this.dir = dir;
    this.gustiness = this.target.gustiness;
    this.syncDir();
  }

  update(dt: number): void {
    const d = Math.min(dt, 0.1);
    this.time += d;
    const k = 1 - Math.exp(-d * this.target.rate * 3); // ~95 % of the way in `seconds`
    this.baseSpeed += (this.target.speed - this.baseSpeed) * k;
    let dd = this.target.dir - this.baseDir;
    dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    this.baseDir += dd * k;
    this.gustiness += (this.target.gustiness - this.gustiness) * k;
    // self-wander: two slow incommensurate sines, minutes long
    const t = this.time;
    const ws = this.wander ? 0.2 * (0.6 * Math.sin(t * 0.041 + 1.1) + 0.4 * Math.sin(t * 0.113 + 2.3)) : 0;
    const wd = this.wander ? 0.2 * (0.7 * Math.sin(t * 0.027 + 0.4) + 0.3 * Math.sin(t * 0.071 + 1.9)) : 0;
    this.speed = this.baseSpeed * (1 + ws);
    this.dir = this.baseDir + wd;
    this.syncDir();
    // gust fronts roll downwind a bit slower than the air (a front is a pressure pattern, not a parcel)
    this.travel += (this.speed * 0.85 + 1.2) * d;
    const u = this.uniforms;
    u.uWindSpeed.value = this.speed;
    u.uWindGustiness.value = this.gustiness;
    u.uWindTravel.value = this.travel;
    u.uWindTime.value = this.time;
    // bridge: trees / undergrowth / Pine-Hollow-style grass sway with the same strength
    windUniforms.uWindStrength.value = Math.min(4, Math.max(0.25, this.speed / REF_SPEED));
  }

  /** gust field 0..1 at (x, z) — identical to WIND_GLSL `windGust` */
  gustAt(x: number, z: number, t = this.time): number {
    const travel = this.travel + (t - this.time) * (this.speed * 0.85 + 1.2);
    const dx = this.dirX, dz = this.dirZ;
    const s = x * dx + z * dz - travel;
    const c = -x * dz + z * dx;
    const w1 = Math.sin(s * 0.165 + Math.sin(c * 0.045 + 1.3) * 1.8 + Math.sin(c * 0.013) * 2.5);
    const f0 = 0.5 + 0.5 * w1; const f1 = f0 * f0 * f0;
    const m = 0.55 + 0.45 * Math.sin(c * 0.031 + s * 0.021 + 0.7);
    const w2 = Math.sin(s * 0.39 + c * 0.11 + 2.1);
    return Math.min(1, Math.max(0, f1 * m + 0.18 * (0.5 + 0.5 * w2)));
  }

  /** wind speed m/s at (x, z) including the gust fronts */
  at(x: number, z: number, t = this.time): number {
    return this.speed * (1 + this.gustiness * (this.gustAt(x, z, t) * 1.6 - 0.35));
  }

  /** wind velocity (m/s, world xz) at a point including gusts; writes into and returns `out` */
  vecAt<T extends { x: number; z: number }>(x: number, z: number, out: T, t = this.time): T {
    const s = this.at(x, z, t);
    out.x = this.dirX * s; out.z = this.dirZ * s;
    return out;
  }

  private syncDir(): void {
    this.dirX = -Math.sin(this.dir);
    this.dirZ = -Math.cos(this.dir);
    this.uniforms.uWindDir.value.set(this.dirX, this.dirZ);
  }
}

/** the world's wind (a singleton — every system reads the same one) */
export const wind = new Wind();
