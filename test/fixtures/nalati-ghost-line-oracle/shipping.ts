import * as THREE from 'three';
import type { AnimalSim as Animal } from '../../../src/engine/entities/AnimalSim';
import type { GhostLine } from '../../../src/shards/nalati-grasslands/runtime/ghostLineKeeper';
import { BOWL } from '../../../src/shards/nalati-grasslands/layout';
import { HORSE_SPEED } from '../../../src/shards/nalati-grasslands/species/horse';
const RIDGE: readonly (readonly [number, number])[] = Array.from({ length: 16 }, (_, i): readonly [number, number] => {
  const t = (i / 16) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
  return [BOWL.x + BOWL.ax * 0.85 * Math.sign(c) * Math.abs(c) ** (2 / 3), BOWL.z + BOWL.az * 0.85 * Math.sign(sn) * Math.abs(sn) ** (2 / 3)];
});
const SPACING = 11, CIRCLE_R = 34, ENGAGE = 70, DISENGAGE = 115;

const GALLOP = 11.5;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const CUM: number[] = [0];
for (let i = 1; i <= RIDGE.length; i++) { const a = RIDGE[i - 1], b = RIDGE[i % RIDGE.length]; CUM.push((CUM[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0)); }
const LOOP = CUM[CUM.length - 1] ?? 1;
export function ridgeAt(s: number, out: THREE.Vector3): THREE.Vector3 {
// BEGIN SHIPPING ridgeAt

  const u = ((s % LOOP) + LOOP) % LOOP;
  let i = 0; while (i < RIDGE.length - 1 && (CUM[i + 1] ?? LOOP) < u) i++;
  const a = RIDGE[i], b = RIDGE[(i + 1) % RIDGE.length];
  if (!a || !b) return out.set(0, 0, 0);
  const t = (u - (CUM[i] ?? 0)) / Math.max(1e-3, (CUM[i + 1] ?? LOOP) - (CUM[i] ?? 0));
  return out.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);

// END SHIPPING ridgeAt
}
export function nearestS(x: number, z: number): number {
// BEGIN SHIPPING nearestS

  let best = 0, bd = Infinity;
  for (let s = 0; s < LOOP; s += 4) { ridgeAt(s, _v); const d = Math.hypot(_v.x - x, _v.z - z); if (d < bd) { bd = d; best = s; } }
  return best;

// END SHIPPING nearestS
}
export function thinkGhost(a: Animal, c: { readonly player: THREE.Vector3 }): void {
// BEGIN SHIPPING thinkGhost

  const m = a.mem;
  const tx = m['tx'], tz = m['tz'];
  a.lookWeight = 0.6; a.lookTarget.copy(c.player);
  if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
  const dx = tx - a.position.x, dz = tz - a.position.z;
  const v = m['v'] ?? HORSE_SPEED.canter;
  a.state = v > HORSE_SPEED.canter ? 'flee' : 'wander';
  a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : v, m['turn'] ?? 2.4);

// END SHIPPING thinkGhost
}
export function farthestS(p: THREE.Vector3): number {
  let s = -1, bd = -1;
  for (let q = 0; q < LOOP; q += 8) { ridgeAt(q, _v); const d = Math.hypot(_v.x - p.x, _v.z - p.z); if (d > bd && d < 260) { bd = d; s = q; } }
  return s;
}
export class GhostLineOracle {
  constructor(private readonly ctx: { readonly player: { readonly position: THREE.Vector3 } }) {}
  steerLine(line: GhostLine<Animal>, dt: number): void {
// BEGIN SHIPPING steerLine

    const p = this.ctx.player.position;
    const lead = line.riders.find((r) => !r.dead);
    if (lead === undefined) return;
    const dLead = Math.hypot(p.x - lead.a.position.x, p.z - lead.a.position.z);
    const plateau = p.y > 18;   // the ridge lines are the plateau's: a player down in the valley is left alone
    if (line.mode === 'patrol' && dLead < ENGAGE && plateau) {
      line.mode = 'engage'; line.engagedT = 0;
      line.theta = Math.atan2(lead.a.position.x - p.x, lead.a.position.z - p.z);
    } else if (line.mode === 'engage' && (dLead > DISENGAGE || !plateau)) {
      line.mode = 'patrol'; line.s = nearestS(lead.a.position.x, lead.a.position.z);
    }
    if (line.mode === 'patrol') {
      line.s += dt * HORSE_SPEED.canter * 0.95;
      for (const r of line.riders) {
        if (r.dead) continue;
        ridgeAt(line.s - r.slot * SPACING + 10, _v);
        const m = r.a.mem;
        // hold the file: a rider behind its slot gallops to catch up
        ridgeAt(line.s - r.slot * SPACING, _w);
        const lag = Math.hypot(_w.x - r.a.position.x, _w.z - r.a.position.z);
        m['tx'] = _v.x; m['tz'] = _v.z; m['v'] = lag > 6 ? GALLOP : HORSE_SPEED.canter; m['turn'] = 2.2;
      }
    } else {
      line.engagedT += dt;
      line.theta += line.dir * dt * GALLOP / CIRCLE_R;
      for (const r of line.riders) {
        if (r.dead) continue;
        const th = line.theta - line.dir * r.slot * (SPACING / CIRCLE_R) + line.dir * 0.4;   // a lookahead along the circle
        const rr = CIRCLE_R + Math.sin(line.engagedT * 0.4 + r.slot) * 5;                    // breathes in and out
        const m = r.a.mem;
        m['tx'] = p.x + Math.sin(th) * rr; m['tz'] = p.z + Math.cos(th) * rr; m['v'] = GALLOP; m['turn'] = 2.8;
      }
    }
  
// END SHIPPING steerLine
  }
}
