// The first-person body: mouse / touch drag to look, WASD or the MOVE stick to walk, kept on the square by simple
// bounds (no physics). A hop for JUMP, a sidestep for DODGE, and a zip along the Fei Zhua's line toward a hook.
import { Vector2, Vector3 } from 'three';
import { Y0, walkable } from '../../chunks/nine-dragon-stack/layout';
import { clamp, smooth } from '../../chunks/nine-dragon-stack/util';

export const EYE = 1.62;

export class Player {
  readonly pos = new Vector3(2.6, Y0, 9);
  yaw = 0;
  pitch = 0;
  walk = 0;
  speed = 0;
  private hopT = -1;
  private dodgeT = -1;
  private readonly dodgeDir = new Vector3();
  private zip: { from: Vector3; to: Vector3; t: number } | null = null;
  readonly keys = new Set<string>();
  readonly lookVel = new Vector2();

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    let id = -1, lx = 0, ly = 0;
    target.addEventListener('pointerdown', (e) => { id = e.pointerId; lx = e.clientX; ly = e.clientY; target.setPointerCapture(e.pointerId); });
    target.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.look(e.clientX - lx, e.clientY - ly);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e: PointerEvent): void => { if (e.pointerId === id) id = -1; };
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  look(dx: number, dy: number): void {
    const k = 0.0042;
    this.yaw += dx * k;
    this.pitch = clamp(this.pitch - dy * k, -1.45, 1.45);
    this.lookVel.x += dx;
    this.lookVel.y += dy;
  }

  forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  eye(): Vector3 {
    let y = this.pos.y + EYE;
    if (this.hopT >= 0) y += Math.sin(Math.PI * clamp(this.hopT / 0.6, 0, 1)) * 0.9;
    if (this.zip !== null) y += Math.sin(Math.PI * clamp(this.zip.t, 0, 1)) * 2.2;
    return new Vector3(this.pos.x, y, this.pos.z);
  }

  hop(): void { if (this.hopT < 0) this.hopT = 0; }

  dodge(): void {
    if (this.dodgeT >= 0) return;
    this.dodgeT = 0;
    const side = this.keys.has('KeyA') ? -1 : 1;
    this.dodgeDir.set(Math.cos(this.yaw) * side, 0, Math.sin(this.yaw) * side);
  }

  /** pull toward a hook: stop at the last walkable point on the way (the balustrade, a wall) */
  zipTo(hook: Vector3): void {
    const from = this.pos.clone();
    const to = from.clone();
    const dir = new Vector3(hook.x - from.x, 0, hook.z - from.z);
    const len = dir.length();
    if (len < 1) return;
    dir.divideScalar(len);
    for (let s = 0; s < len - 1.5; s += 0.25) {
      const p = from.clone().addScaledVector(dir, s);
      if (!walkable(p.x, p.z)) break;
      to.copy(p);
    }
    this.zip = { from, to, t: 0 };
  }

  update(dt: number, stick: Vector2): void {
    const k = this.keys;
    const f = new Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const move = new Vector3();
    if (k.has('KeyW') || k.has('ArrowUp')) move.add(f);
    if (k.has('KeyS') || k.has('ArrowDown')) move.sub(f);
    if (k.has('KeyD') || k.has('ArrowRight')) move.add(r);
    if (k.has('KeyA') || k.has('ArrowLeft')) move.sub(r);
    move.addScaledVector(f, stick.y).addScaledVector(r, stick.x);
    if (move.lengthSq() > 1) move.normalize();
    const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 1.8 : 1;
    const v = 3.6 * run;
    let step = move.clone().multiplyScalar(v * dt);
    if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      step.addScaledVector(this.dodgeDir, (1 - smooth(0, 0.35, this.dodgeT)) * 9 * dt);
      if (this.dodgeT > 0.35) this.dodgeT = -1;
    }
    if (this.zip !== null) {
      this.zip.t += dt / 0.7;
      const t = smooth(0, 1, this.zip.t);
      const target = this.zip.from.clone().lerp(this.zip.to, t);
      step = target.sub(this.pos).setY(0);
      if (this.zip.t >= 1) this.zip = null;
    }
    this.speed = step.length() / Math.max(dt, 1e-4) / 3.6;
    this.walk += step.length() * 2.1;
    // slide along the bounds: try the full step, then each axis
    const tryMove = (dx: number, dz: number): boolean => {
      if (walkable(this.pos.x + dx, this.pos.z + dz)) { this.pos.x += dx; this.pos.z += dz; return true; }
      return false;
    };
    if (!tryMove(step.x, step.z)) { tryMove(step.x, 0); tryMove(0, step.z); }
    if (this.hopT >= 0) { this.hopT += dt; if (this.hopT > 0.6) this.hopT = -1; }
    this.lookVel.multiplyScalar(Math.exp(-dt * 12));
  }

  place(x: number, y: number, z: number, yawDeg: number, pitchDeg: number): void {
    this.pos.set(x, y, z);
    this.yaw = (yawDeg * Math.PI) / 180;
    this.pitch = (pitchDeg * Math.PI) / 180;
    this.hopT = -1;
    this.dodgeT = -1;
    this.zip = null;
    this.lookVel.set(0, 0);
  }
}
