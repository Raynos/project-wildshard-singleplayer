import type { Vector3 } from 'three';
import type { ThrownProfile } from '../../weapons/thrownProfile';

// only *-legacy imports this; deleted with the legacy copies (SHARD-PLATFORM-NEXT N5)
export class Thrown {
  ammo: number;
  constructor(readonly profile: ThrownProfile) { this.ammo = profile.carried; }
  flightStep(pos: Vector3, vel: Vector3, dt: number): void { vel.y -= this.profile.gravity * dt; pos.addScaledVector(vel, dt); }
  release(): boolean {
    if (this.ammo <= 0) return false;
    this.ammo--; return true;
  }
}
