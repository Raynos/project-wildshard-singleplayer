import * as schema from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { BOWL } from '../layout';
import { HORSE_SPEED } from '../species/horse';

/** One admitted night line; identity, death and body ownership remain with the real ghost roster. */
export interface GhostLineMember<A extends AnimalSim> { readonly a: A; readonly slot: number; dead: boolean }
export interface GhostLine<A extends AnimalSim> { readonly riders: readonly GhostLineMember<A>[]; s: number; mode: 'patrol' | 'engage'; theta: number; dir: 1 | -1; engagedT: number }
const RIDGE: readonly (readonly [number, number])[] = Array.from({ length: 16 }, (_, i): readonly [number, number] => {
  const t = (i / 16) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
  return [BOWL.x + BOWL.ax * 0.85 * Math.sign(c) * Math.abs(c) ** (2 / 3), BOWL.z + BOWL.az * 0.85 * Math.sign(sn) * Math.abs(sn) ** (2 / 3)];
});
const SPACING = 11, CIRCLE_R = 34, ENGAGE = 70, DISENGAGE = 115;

const GALLOP = 11.5;
const CUM: number[] = [0];
for (let i = 1; i <= 16; i++) {
  const a = RIDGE[i - 1], b = RIDGE[i % RIDGE.length];
  CUM.push((CUM[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0));
}
const LOOP = CUM[CUM.length - 1] ?? 1;
// 4096 samples cover the authored loop; refusal prevents a future route silently losing its end.
if (LOOP > 16384) throw new Error('Ghost ridge exceeds its sampling bound');
const num = schema.pipe(schema.number(), schema.finite());
const Saved = schema.strictObject({ s: num, mode: schema.picklist(['patrol', 'engage']), theta: num, dir: schema.picklist([1, -1]), engagedT: num,
  riders: schema.pipe(schema.array(schema.strictObject({ id: schema.string(), slot: schema.pipe(num, schema.integer(), schema.minValue(0), schema.maxValue(255)), dead: schema.boolean() })), schema.maxLength(256)) });
const invalidLine = new Error('Invalid ghost rider line');
/** The same authored path and puppet law as GhostRiders and the ghost species, without a view or a clock singleton. */
export class GhostLineKeeper<A extends AnimalSim> {
  private readonly point = new Vector3(); private readonly slotPoint = new Vector3();
  constructor(readonly line: GhostLine<A>, private readonly player: { readonly position: Vector3 }) {
    if (line.riders.length > 256) throw invalidLine;
    const identities = new Set<string>(), slots = new Set<number>();
    for (let i = 0; i < 256; i++) {
      const rider = line.riders[i]; if (rider === undefined) break;
      if (!Number.isInteger(rider.slot) || rider.slot < 0 || rider.slot > 255 || identities.has(rider.a.entityId) || slots.has(rider.slot)) throw invalidLine;
      identities.add(rider.a.entityId); slots.add(rider.slot);
    }
    schema.parse(Saved, this.snapshot());
  }
  ridgeAt(s: number, out: Vector3): Vector3 {
  const u = ((s % LOOP) + LOOP) % LOOP;
  let i = 0; for (let j = 0; j < 15; j++) { if ((CUM[i + 1] ?? LOOP) >= u) break; i++; }
  const a = RIDGE[i], b = RIDGE[(i + 1) % RIDGE.length];
  if (!a || !b) return out.set(0, 0, 0);
  const t = (u - (CUM[i] ?? 0)) / Math.max(1e-3, (CUM[i + 1] ?? LOOP) - (CUM[i] ?? 0));
  return out.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
  }
  nearestS(x: number, z: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 4096; i++) { const s = i * 4; if (s >= LOOP) break; this.ridgeAt(s, this.point); const d = Math.hypot(this.point.x - x, this.point.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
  }
  /** SpawnLine's farthest admissible path sample, in original sample order (and original -1 fallback). */
  farthestS(): number {
    const p = this.player.position; let s = -1, bd = -1;
    for (let i = 0; i < 2048; i++) {
      const q = i * 8; if (q >= LOOP) break;
      this.ridgeAt(q, this.point); const d = Math.hypot(this.point.x - p.x, this.point.z - p.z);
      if (d > bd && d < 260) { bd = d; s = q; }
    }
    return s;
  }
  step(dt: number): void {
    const line = this.line;
    const p = this.player.position;
    let lead: GhostLineMember<A> | undefined;
    for (let i = 0; i < 256; i++) { const r = line.riders[i]; if (r === undefined) break; if (!r.dead) { lead = r; break; } }
    if (lead === undefined) return;
    const dLead = Math.hypot(p.x - lead.a.position.x, p.z - lead.a.position.z);
    const plateau = p.y > 18;   // the ridge lines are the plateau's: a player down in the valley is left alone
    if (line.mode === 'patrol' && dLead < ENGAGE && plateau) {
      line.mode = 'engage'; line.engagedT = 0;
      line.theta = Math.atan2(lead.a.position.x - p.x, lead.a.position.z - p.z);
    } else if (line.mode === 'engage' && (dLead > DISENGAGE || !plateau)) {
      line.mode = 'patrol'; line.s = this.nearestS(lead.a.position.x, lead.a.position.z);
    }
    if (line.mode === 'patrol') {
      line.s += dt * HORSE_SPEED.canter * 0.95;
      for (let i = 0; i < 256; i++) {
        const r = line.riders[i]; if (r === undefined) break;
        if (r.dead) continue;
        this.ridgeAt(line.s - r.slot * SPACING + 10, this.point);
        const m = r.a.mem;
        // hold the file: a rider behind its slot gallops to catch up
        this.ridgeAt(line.s - r.slot * SPACING, this.slotPoint);
        const lag = Math.hypot(this.slotPoint.x - r.a.position.x, this.slotPoint.z - r.a.position.z);
        m['tx'] = this.point.x; m['tz'] = this.point.z; m['v'] = lag > 6 ? GALLOP : HORSE_SPEED.canter; m['turn'] = 2.2;
      }
    } else {
      line.engagedT += dt;
      line.theta += line.dir * dt * GALLOP / CIRCLE_R;
      for (let i = 0; i < 256; i++) {
        const r = line.riders[i]; if (r === undefined) break;
        if (r.dead) continue;
        const th = line.theta - line.dir * r.slot * (SPACING / CIRCLE_R) + line.dir * 0.4;   // a lookahead along the circle
        const rr = CIRCLE_R + Math.sin(line.engagedT * 0.4 + r.slot) * 5;                    // breathes in and out
        const m = r.a.mem;
        m['tx'] = p.x + Math.sin(th) * rr; m['tz'] = p.z + Math.cos(th) * rr; m['v'] = GALLOP; m['turn'] = 2.8;
      }
    }
    }
  snapshot(): schema.InferOutput<typeof Saved> { const line = this.line; return { s: line.s, mode: line.mode, theta: line.theta, dir: line.dir,
    engagedT: line.engagedT, riders: line.riders.map(r => ({ id: r.a.entityId, slot: r.slot, dead: r.dead })) }; }
  restore(input: unknown): void {
    const s = schema.parse(Saved, input), line = this.line;
    if (s.riders.length !== line.riders.length) throw invalidLine;
    for (let i = 0; i < 256; i++) {
      const row = s.riders[i]; if (row === undefined) break;
      const r = line.riders[i]; if (r === undefined || r.a.entityId !== row.id || r.slot !== row.slot) throw invalidLine;
    }
    line.s = s.s; line.mode = s.mode; line.theta = s.theta; line.dir = s.dir; line.engagedT = s.engagedT;
    for (let i = 0; i < 256; i++) { const row = s.riders[i]; if (row === undefined) break; const r = line.riders[i]; if (r !== undefined) r.dead = row.dead; }
  }
}

/** Actual ghost-rider species law, including canter/gallop state and 0.6 look weight (the captain fallback differs). */
export function thinkGhostBody(a: AnimalSim, c: { readonly player: Vector3 }): void {
  const m = a.mem;
  const tx = m['tx'], tz = m['tz'];
  a.lookWeight = 0.6; a.lookTarget.copy(c.player);
  if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
  const dx = tx - a.position.x, dz = tz - a.position.z;
  const v = m['v'] ?? HORSE_SPEED.canter;
  a.state = v > HORSE_SPEED.canter ? 'flee' : 'wander';
  a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : v, m['turn'] ?? 2.4);
}
