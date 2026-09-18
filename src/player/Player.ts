import * as THREE from 'three';
import { heightAt } from '../world/Heightfield';
import { CHUNK_HALF } from '../core/config';
import type { Forest } from '../world/Forest';
import { Hoverboard } from './Hoverboard';

export interface Collider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const EYE = 1.68;
const RADIUS = 0.38;
const GRAVITY = 22;

// ── hoverboard (toggle: H / the HOVER touch button) ──
export const HOVER_TOP = 14;          // m/s cruise
const HOVER_ACCEL = 12;               // m/s² with input → 0 → top in ~1.2 s
const HOVER_DECEL = 3;                // m/s² gliding with no input (25 % of accel)
const HOVER_LAT_DRAG = 3.5;           // /s — sideways velocity (relative to the heading) bleeds off faster than forward: carve, not shopping cart
const HOVER_HEIGHT = 0.45;            // m above the terrain / platform
const HOVER_SPRING_K = 70;            // spring to the ride height (ω ≈ 8.4 rad/s) …
const HOVER_SPRING_C = 6.5;           // … slightly under-damped (ζ ≈ 0.39) so it bobs after a hop / a bump
const HOVER_SPRING_MAX = 30;          // m/s² — clamp so a cliff edge feels like falling, not a slingshot
const HOVER_HOP = 5;                  // m/s
const HOVER_ROLL = 6 * Math.PI / 180; // camera roll cap, reached at HOVER_ROLL_AT m/s sideways
const HOVER_ROLL_AT = 7;
const HOVER_PITCH = 0.03;             // rad nose-down at top speed

export class Player {
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  crouching = false;
  sprinting = false;
  speedFactor = 0;   // for headbob / audio
  bobTime = 0;
  locked = false;
  colliders: Collider[] = [];
  /** extra walkable surfaces (cabin floors, porch decks): return a world y or undefined */
  platforms: ((x: number, z: number) => number | undefined)[] = [];
  keys = new Set<string>();
  /** analog input from on-screen controls (TouchControls): x = strafe (+right), y = forward (+ahead), both -1..1 */
  touchMove = { x: 0, y: 0 };
  touchSprint = false;
  touchJump = false;
  /** hoverboard mode (H key / HOVER touch button) — see setHover() */
  hover = false;
  /** 0..1 smoothed hover state (viewmodel fade, camera blend) */
  hoverBlend = 0;
  /** hover telemetry for the viewmodel / camera: lateral (+right) and forward velocity along the heading, forward acceleration, ride-height error */
  hoverLat = 0; hoverFwd = 0; hoverAccel = 0; hoverBob = 0;
  onHoverChange?: (on: boolean) => void;
  readonly board: Hoverboard;
  private eyeOffset = EYE;
  private landImpulse = 0;
  private roll = 0; private pitchLean = 0;
  onJump?: () => void;
  onLand?: (hard: boolean) => void;
  onStep?: (sprinting: boolean) => void;
  private lastBobPhase = 0;

  constructor(public camera: THREE.PerspectiveCamera, private forest: Forest, private canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyH' && !e.repeat) this.setHover(!this.hover);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; if (!this.locked) this.keys.clear(); });
    window.addEventListener('blur', () => this.keys.clear());
    this.board = new Hoverboard(camera);
  }

  lock() { this.canvas.requestPointerLock?.(); } // undefined on iOS Safari — touch input never needs it

  /** step on / off the hoverboard. Off: the board fades and gravity lands you; on: the spring lifts you to ride height. */
  setHover(on: boolean) {
    if (on === this.hover) return;
    this.hover = on;
    if (on) { this.crouching = false; this.sprinting = false; this.onGround = false; }
    this.onHoverChange?.(on);
  }

  spawn(x: number, z: number, yaw: number) {
    this.position.set(x, heightAt(x, z), z);
    this.yaw = yaw; this.pitch = 0;
    this.velocity.set(0, 0, 0);
  }

  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt: number) {
    dt = Math.min(dt, 0.05);
    const k = this.keys;
    const fwd = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + this.touchMove.y));
    const str = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.touchMove.x));
    const hover = this.hover;
    this.crouching = !hover && (k.has('ControlLeft') || k.has('KeyC'));
    this.sprinting = !hover && (k.has('ShiftLeft') || this.touchSprint) && fwd > 0 && !this.crouching;
    const speed = this.crouching ? 2.2 : this.sprinting ? 7.2 : 4.3;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = (-sin * fwd + cos * str), mz = (-cos * fwd - sin * str);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const jump = k.has('Space') || this.touchJump; this.touchJump = false;

    // ground: terrain, or a platform if we are at/above it (step up ≤ 0.5 m)
    const groundAt = () => {
      let g = heightAt(this.position.x, this.position.z);
      for (const p of this.platforms) {
        const y = p(this.position.x, this.position.z);
        if (y !== undefined && y > g && this.position.y >= y - 0.5) g = y;
      }
      return g;
    };

    if (hover) {
      // ── hoverboard: momentum steering — velocity is pulled toward the input direction at a fixed rate, glides with no input ──
      const v = this.velocity;
      const inAir = this.hoverBob > 0.35;                            // above the ride height (hop / ledge): half the grip
      const grip = inAir ? 0.5 : 1;
      const want = len > 0.02;
      const tx = want ? mx * HOVER_TOP : 0, tz = want ? mz * HOVER_TOP : 0;
      const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz);
      const rate = (want ? HOVER_ACCEL : HOVER_DECEL) * grip;
      const step = Math.min(dl, rate * dt);
      const vfx = v.x, vfz = v.z;
      if (dl > 1e-6) { v.x += dx / dl * step; v.z += dz / dl * step; }
      // carve: the sideways component (relative to the heading) is pulled toward what the stick asks for much faster
      // than the forward one — turn at speed and the old momentum, now sideways, bleeds off instead of sliding you
      const fx = -sin, fz = -cos, rx = cos, rz = -sin;
      let vf = v.x * fx + v.z * fz, vl = v.x * rx + v.z * rz;
      const tl = tx * rx + tz * rz;
      vl += (tl - vl) * (1 - Math.exp(-HOVER_LAT_DRAG * grip * dt));
      v.x = fx * vf + rx * vl; v.z = fz * vf + rz * vl;
      this.hoverLat = vl; this.hoverFwd = vf;
      const af = ((v.x - vfx) * fx + (v.z - vfz) * fz) / dt;
      this.hoverAccel += (af - this.hoverAccel) * Math.min(1, dt * 8);

      // ride height: a stiff, slightly under-damped spring to ground + HOVER_HEIGHT (no gravity — the repulsors hold you)
      this.position.x += v.x * dt;
      this.position.z += v.z * dt;
      this.collide();
      const g = groundAt();
      const target = g + HOVER_HEIGHT;
      const err = target - this.position.y;
      if (jump && this.onGround) { v.y = HOVER_HOP; this.onGround = false; this.onJump?.(); }
      const a = Math.max(-HOVER_SPRING_MAX, Math.min(HOVER_SPRING_MAX, HOVER_SPRING_K * err)) - HOVER_SPRING_C * v.y;
      v.y += a * dt;
      this.position.y += v.y * dt;
      if (this.position.y < g) { this.position.y = g; if (v.y < 0) v.y = 0; } // steep slope / bump: the board never goes under
      this.hoverBob = this.position.y - target;
      this.onGround = Math.abs(this.hoverBob) < 0.3;                 // "grounded" = riding near the ride height (hop allowed)
    } else {
      const accel = this.onGround ? 14 : 3;
      this.velocity.x += (mx * speed - this.velocity.x) * Math.min(1, accel * dt);
      this.velocity.z += (mz * speed - this.velocity.z) * Math.min(1, accel * dt);

      if (jump && this.onGround && !this.crouching) { this.velocity.y = 7.2; this.onGround = false; this.onJump?.(); }
      this.velocity.y -= GRAVITY * dt;

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y += this.velocity.y * dt;

      this.collide();

      const g = groundAt();
      if (this.position.y <= g) {
        if (!this.onGround) { const hard = this.velocity.y < -9; this.landImpulse = Math.min(0.35, -this.velocity.y * 0.03); this.onLand?.(hard); }
        this.position.y = g; this.velocity.y = 0; this.onGround = true;
      } else if (this.position.y - g > 0.05) this.onGround = false;
      this.hoverLat = this.hoverFwd = this.hoverAccel = this.hoverBob = 0;
    }

    // chunk boundary: invisible wall (the chunk floats — nothing to walk onto)
    const lim = CHUNK_HALF - 1.2;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // camera
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedFactor = this.onGround && !hover ? hSpeed / 7.2 : 0;
    const targetEye = this.crouching ? EYE - 0.65 : EYE;
    this.eyeOffset += (targetEye - this.eyeOffset) * Math.min(1, dt * 10);
    this.landImpulse *= Math.exp(-dt * 9);
    this.hoverBlend += ((hover ? 1 : 0) - this.hoverBlend) * Math.min(1, dt * 4);
    if (!hover) this.bobTime += dt * (this.sprinting ? 11.5 : 8.5) * Math.min(1, hSpeed / 2);
    const bobAmp = this.onGround && !hover ? Math.min(1, hSpeed / 3) * (this.sprinting ? 0.055 : 0.03) : 0;
    const bobY = Math.sin(this.bobTime * 2) * bobAmp;
    const bobX = Math.cos(this.bobTime) * bobAmp * 0.8;
    const phase = Math.floor(this.bobTime / Math.PI);
    if (phase !== this.lastBobPhase && bobAmp > 0.005) { this.lastBobPhase = phase; this.onStep?.(this.sprinting); }
    // hover: roll gently into strafes / carves (from lateral velocity), nose down a hair at speed
    const rollT = hover ? -Math.max(-1, Math.min(1, this.hoverLat / HOVER_ROLL_AT)) * HOVER_ROLL : 0;
    const pitchT = hover ? -(hSpeed / HOVER_TOP) * HOVER_PITCH : 0;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5);
    this.pitchLean += (pitchT - this.pitchLean) * Math.min(1, dt * 3);

    this.camera.position.set(this.position.x + bobX * cos, this.position.y + this.eyeOffset + bobY - this.landImpulse, this.position.z - bobX * sin);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.pitchLean;
    this.camera.rotation.z = Math.sin(this.bobTime) * bobAmp * 0.25 - str * 0.012 * (1 - this.hoverBlend) + this.roll;

    this.board.update(dt, this);
  }

  private collide() {
    // trees (cylinders)
    const p = this.position;
    for (const t of this.forest.nearby(p.x, p.z, RADIUS)) {
      const dx = p.x - t.x, dz = p.z - t.z;
      const d = Math.hypot(dx, dz), min = t.r + RADIUS;
      if (d < min && d > 1e-4) { p.x = t.x + (dx / d) * min; p.z = t.z + (dz / d) * min; }
    }
    // oriented boxes (cabin walls etc.)
    for (const c of this.colliders) {
      if (p.y + 0.2 > c.yTop || p.y + 1.6 < c.yBottom) continue;
      const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
      const lx = (p.x - c.x) * cos - (p.z - c.z) * sin;
      const lz = (p.x - c.x) * sin + (p.z - c.z) * cos;
      const ox = c.hw + RADIUS - Math.abs(lx), oz = c.hd + RADIUS - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        let nx = lx, nz = lz;
        if (ox < oz) { nx = Math.sign(lx || 1) * (c.hw + RADIUS); } else { nz = Math.sign(lz || 1) * (c.hd + RADIUS); }
        const c2 = Math.cos(c.rot), s2 = Math.sin(c.rot);
        p.x = c.x + nx * c2 - nz * s2;
        p.z = c.z + nx * s2 + nz * c2;
      }
    }
  }
}
