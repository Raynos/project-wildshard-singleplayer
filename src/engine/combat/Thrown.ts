import type { Vector3 } from 'three';

import type { ThrownProfile } from './thrownProfile';

/** A composing weapon keeps its slot/input/pose; this helper owns its thrown row and ammunition. */
export class Thrown {
  readonly profile: ThrownProfile;
  ammo: number;
  constructor(profile: ThrownProfile) { this.profile = profile; this.ammo = profile.carried; }
  flightStep(pos: Vector3, vel: Vector3, dt: number): void { vel.y -= this.profile.gravity * dt; pos.addScaledVector(vel, dt); }
  release(): boolean {
    if (this.ammo <= 0) return false;
    this.ammo--; this.onRelease(1); return true;
  }
  protected onRelease(_power: number): void { /* Rung-2 thrown helpers may add release behavior. */ }
  protected onStick(_point: Vector3): void { /* The composing weapon supplies its surface/mesh presentation. */ }
}
