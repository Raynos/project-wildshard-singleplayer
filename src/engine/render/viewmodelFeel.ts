import { Vector2, type WebGLRenderer, type PerspectiveCamera } from 'three';
import type { Puffs } from '../combat/view/ranged';
import { ads } from '../combat/blocks/ads';
import { fovForAspect } from '../combat/blocks/melee';
import { worldTime } from '../core/time';

/** Drawing-buffer port used by viewmodel effects without exposing a renderer backend. */
export type DrawingBuffer = Pick<WebGLRenderer, 'getDrawingBufferSize' | 'domElement' | 'getPixelRatio'>;
export interface LookSpring { yaw: number; pitch: number; yawVelocity: number; pitchVelocity: number }
export interface LookLag { gain: number; clampYaw: number; clampPitch: number; k: number; c: number }
export function viewmodel(lag: LookLag): { step: (state: LookSpring, delta: Vector2, dt: number, timeScale?: number) => void; dispose: () => void } {
  return { step: (state, delta, dt, timeScale = worldTime.scale) => {
    state.yaw = Math.max(-lag.clampYaw, Math.min(lag.clampYaw, state.yaw - delta.x * lag.gain));
    state.pitch = Math.max(-lag.clampPitch, Math.min(lag.clampPitch, state.pitch - delta.y * lag.gain));
    let remaining = dt * timeScale;
    for (let substep = 0; substep < 4096; substep++) {
      if (!(remaining > 0)) break;
      const h = Math.min(remaining, 1 / 120);
      state.yawVelocity += (-state.yaw * lag.k - state.yawVelocity * lag.c) * h; state.yaw += state.yawVelocity * h;
      state.pitchVelocity += (-state.pitch * lag.k - state.pitchVelocity * lag.c) * h; state.pitch += state.pitchVelocity * h;
      remaining -= 1 / 120;
    }
    if (remaining > 0) throw new RangeError('View spring step exceeds its bounded clock');
  }, dispose: () => undefined };
}


/** Coefficients for a camera-held ranged view; the action/reload/contact owner stays with the weapon. */
export interface RangedFrameRow {
  readonly clock: 'frame' | 'world';
  readonly fovWhen: 'always' | 'active';
  readonly recoil: { readonly decay: number; readonly attack: number; readonly recovery: number };
  readonly lag: LookLag;
  readonly clampAfter: boolean;
}
interface RangedHeading { readonly yaw: number; pitch: number; readonly sprinting: boolean }
interface RangedControls {
  readonly enabled: boolean; readonly active: boolean; readonly held: boolean; readonly reloading: boolean;
  readonly adsDuration: number; readonly kick: number;
}
interface RangedCamera { readonly aspect: number; fov: number; updateProjectionMatrix: () => void }
/** One owner for ADS, camera recoil recovery and heading lag. It never advances reloads or contacts.
 * Coefficients and clock are explicit; camera/player ports are borrowed, without retaining a world or renderer.
 */
export class RangedFrame {
  mouseAds = false;
  adsBlend = 0;
  recoil = 0;
  readonly lag: LookSpring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm: ReturnType<typeof viewmodel>;
  private readonly delta = new Vector2();
  private readonly resolution = new Vector2();
  private lastYaw: number;
  private lastPitch: number;
  private kickPending = 0;
  private kickApplied = 0;
  private fov: number;
  private readonly row: RangedFrameRow;
  private readonly hipFov: number;
  private readonly adsFov: number;
  constructor(row: RangedFrameRow, heading: RangedHeading, hipFov: number, adsFov: number) {
    const coefficients = [row.recoil.decay, row.recoil.attack, row.recoil.recovery,
      row.lag.gain, row.lag.clampYaw, row.lag.clampPitch, row.lag.k, row.lag.c, hipFov, adsFov];
    if (!['frame', 'world'].includes(row.clock) || !['always', 'active'].includes(row.fovWhen)
      || coefficients.some(value => !Number.isFinite(value) || value < 0 || value > 10000)) throw new RangeError('Invalid ranged frame coefficients');
    this.row = row; this.hipFov = hipFov; this.adsFov = adsFov;
    this.vm = viewmodel(row.lag); this.lastYaw = heading.yaw; this.lastPitch = heading.pitch; this.fov = hipFov;
  }
  /** The original recoil impulse is claimed at the weapon's shot phase. */
  shot(kick: number): void { this.recoil = 1; this.kickPending = kick; }
  /** Returns the published ADS state, after the action/flash phases and before the held pose. */
  sampleFrame(dt: number, heading: RangedHeading, controls: RangedControls, camera: RangedCamera,
    frustums: { updateFrustums: () => void }): boolean {
    const h = dt * (this.row.clock === 'world' ? worldTime.scale : 1), row = this.row;
    if (heading.sprinting || !controls.enabled) this.mouseAds = false;
    const aimed = (this.mouseAds || controls.held) && controls.enabled && !controls.reloading && !heading.sprinting;
    this.adsBlend = ads(this.adsBlend, aimed, h, controls.adsDuration);
    const a = this.adsBlend * this.adsBlend * (3 - 2 * this.adsBlend);
    const targetFov = fovForAspect(this.hipFov + (this.adsFov - this.hipFov) * a, camera.aspect);
    if ((row.fovWhen === 'always' || controls.active) && Math.abs(targetFov - this.fov) > .01) {
      this.fov = targetFov; camera.fov = this.fov; camera.updateProjectionMatrix(); frustums.updateFrustums();
    }
    this.recoil *= Math.exp(-h * row.recoil.decay);
    if (this.kickPending > 0) {
      const kick = Math.min(this.kickPending, controls.kick * h * row.recoil.attack);
      heading.pitch += kick; this.kickApplied += kick; this.kickPending -= kick;
    } else if (this.kickApplied > 0) {
      const recovery = this.kickApplied * Math.min(1, h * row.recoil.recovery);
      heading.pitch -= recovery; this.kickApplied -= recovery;
    }
    let yaw = heading.yaw - this.lastYaw, pitch = heading.pitch - this.lastPitch;
    this.lastYaw = heading.yaw; this.lastPitch = heading.pitch;
    if (Math.abs(yaw) > 1) yaw = 0; if (Math.abs(pitch) > 1) pitch = 0;
    this.vm.step(this.lag, this.delta.set(yaw, pitch), h, 1);
    if (row.clampAfter) {
      this.lag.yaw = Math.max(-row.lag.clampYaw, Math.min(row.lag.clampYaw, this.lag.yaw));
      this.lag.pitch = Math.max(-row.lag.clampPitch, Math.min(row.lag.clampPitch, this.lag.pitch));
    }
    return aimed;
  }
  /** Effects publish after the pose/contact phases. Paint ports keep their own tracer style and clocks. */
  presentEffects<T>(dt: number, time: number, renderer: Parameters<Puffs['update']>[1], camera: PerspectiveCamera,
    puffs: Puffs, tracers: readonly T[], paint: (tracer: T, time: number, camera: PerspectiveCamera, resolution: Vector2) => void): void {
    if (tracers.length > 128) throw new RangeError('Ranged tracer roster exceeds its bound');
    puffs.update(dt, renderer, camera); renderer.getDrawingBufferSize(this.resolution);
    for (let i = 0; i < 128; i++) {
      const tracer = tracers[i]; if (tracer === undefined) break;
      paint(tracer, time, camera, this.resolution);
    }
  }

}
