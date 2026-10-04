import { worldTime } from '../core/time';
import type { WebGLRenderer, Vector2 } from 'three';

/** Drawing-buffer port used by viewmodel effects without exposing a renderer backend. */
export type DrawingBuffer = Pick<WebGLRenderer, 'getDrawingBufferSize' | 'domElement' | 'getPixelRatio'>;
export interface LookSpring { yaw: number; pitch: number; yawVelocity: number; pitchVelocity: number }
export interface LookLag { gain: number; clampYaw: number; clampPitch: number; k: number; c: number }
export function viewmodel(lag: LookLag): { step: (state: LookSpring, delta: Vector2, dt: number) => void; dispose: () => void } {
  return { step: (state, delta, dt) => {
    state.yaw = Math.max(-lag.clampYaw, Math.min(lag.clampYaw, state.yaw - delta.x * lag.gain));
    state.pitch = Math.max(-lag.clampPitch, Math.min(lag.clampPitch, state.pitch - delta.y * lag.gain));
    for (let remaining = dt * worldTime.scale; remaining > 0; remaining -= 1 / 120) {
      const h = Math.min(remaining, 1 / 120);
      state.yawVelocity += (-state.yaw * lag.k - state.yawVelocity * lag.c) * h; state.yaw += state.yawVelocity * h;
      state.pitchVelocity += (-state.pitch * lag.k - state.pitchVelocity * lag.c) * h; state.pitch += state.pitchVelocity * h;
    }
  }, dispose: () => undefined };
}
