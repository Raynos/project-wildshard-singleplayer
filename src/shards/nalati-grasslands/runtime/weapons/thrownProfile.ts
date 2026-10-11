/** Numeric launch, gravity, recovery and ammunition parameters for a composing thrown helper. */
export interface ThrownProfile {
  id: `weapon.${string}`; speed: number; gravity: number; damage: number; headMultiplier: number;
  radius: number; headOffset: number; windup: number; release: number; recovery: number;
  carried: number; pool: number; pickupRadius: number; pickupHeight: number; survive: number;
  arcPoints: number; arcAfter: number; stagger: number;
}

