import type { Rng } from '../../../src/engine/core/rng';
import type { HORSE_SPEED as Speeds } from '../../../src/shards/nalati-grasslands/species/horse';
import type { ShepherdBody as Animal, ShepherdMotion, ShepherdState } from '../../../src/shards/nalati-grasslands/creatures/shepherdRule';

/** Original shipping decision body, unchanged; the wrapper only supplies its original ports. */
export function shippingShepherd(this: ShepherdState & { ctx: { wildlife: { livingWolves: Animal[] } }; lastCrack: ShepherdMotion<Animal>['crack']; crack: (wolf: Animal, dx: number, dz: number) => void },
  dt: number, h: Animal, f: { cx: number; cz: number }, app: { rng: { stream: (name: string) => Rng } }, HORSE_SPEED: typeof Speeds): ShepherdMotion<Animal> {
  const GUARD = 50, CRACK_R = 4.2, RING = 22;
// BEGIN SHIPPING BODY
    this.crackCd = Math.max(0, this.crackCd - dt);
    const hx = h.position.x, hz = h.position.z;
    let wolf: Animal | null = null, wd = GUARD;
    for (const w of this.ctx.wildlife.livingWolves) {
      const d = Math.hypot(w.position.x - f.cx, w.position.z - f.cz);
      if (d < wd) { wd = d; wolf = w; }
    }
    let speed: number, yaw: number;
    if (wolf !== null) {
      const dx = wolf.position.x - hx, dz = wolf.position.z - hz, d = Math.hypot(dx, dz);
      yaw = Math.atan2(dx, dz);
      speed = d > 9 ? HORSE_SPEED.gallop * 0.92 : d > 3 ? HORSE_SPEED.canter * 0.8 : HORSE_SPEED.trot;
      if (d < CRACK_R && this.crackCd <= 0) this.crack(wolf, dx / (d || 1), dz / (d || 1));
    } else {
      const dx = f.cx - hx, dz = f.cz - hz, d = Math.hypot(dx, dz);
      if (d > RING + 12) { yaw = Math.atan2(dx, dz); speed = d > 45 ? HORSE_SPEED.canter * 0.8 : HORSE_SPEED.trot; }
      else if (this.restT > 0) { this.restT -= dt; yaw = h.yaw; speed = 0; }
      else {
        // walk the ring: aim a little ahead round it; now and then stand and watch
        this.patrolA = Math.atan2(hx - f.cx, hz - f.cz) + 0.35;
        const tx = f.cx + Math.sin(this.patrolA) * RING, tz = f.cz + Math.cos(this.patrolA) * RING;
        yaw = Math.atan2(tx - hx, tz - hz); speed = HORSE_SPEED.walk;
        if (app.rng.stream('ai').next() < dt * 0.02) this.restT = 6 + app.rng.stream('ai').next() * 8;
      }
    }
// END SHIPPING BODY
  return { yaw, speed, turn: speed > 6 ? 3.2 : 2.2, crack: this.lastCrack };
}
