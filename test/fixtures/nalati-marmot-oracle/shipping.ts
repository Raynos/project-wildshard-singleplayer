import { Rng } from '../../../src/engine/core/rng';
import { TickScheduler } from '../../../src/engine/app/scheduler';
import type { MarmotState as Marmot, MarmotGround } from '../../../src/shards/nalati-grasslands/creatures/marmotBrain';
interface Point { x: number; y: number; z: number }
/** Frozen shipping decision body; drawing is outside this algorithm oracle. */
export class MarmotOracle {
  readonly list: Marmot[] = [];
  readonly whistles: [number, number][] = [];
  private readonly rng: Rng;
  private readonly scheduler = new TickScheduler();
  private acc = 0;
  private readonly poseDue = new WeakMap<Marmot, boolean>();
  readonly onWhistle = (x: number, z: number): void => { this.whistles.push([x,z]); };
  constructor(seed: number, private readonly ground: MarmotGround) { this.rng = new Rng(seed ^ 0x6a2b); }
  build(sites: {x:number;z:number}[], perSite=5): void {
    const rng = this.rng;
    for (const s of sites) {
      if (!inChunk(s.x, s.z, 10)) continue;
      const n = rng.int(3, perSite);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), r = rng.range(0.5, 5);
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        this.list.push({ x, z, bx: s.x + Math.cos(a) * 0.4, bz: s.z + Math.sin(a) * 0.4, yaw: rng.range(0, Math.PI * 2), stand: 0, sink: 0, state: 0, t: rng.range(1, 6), tx: x, tz: z });
      }
    }
  }
  update(dt: number, player: Point, playerSpeed: number, crouched: boolean): void {
    const heightAt = this.ground.heightAt;
// BEGIN SHIPPING UPDATE
    this.scheduler.beginFrame(dt, player);
    // Keep the authored near decision clock; far colonies pause with FX (E357 J2 / P6).
    this.acc += dt;
    const think = this.acc >= 0.1;
    if (think) this.acc = 0;
    const rng = this.rng;
    let whistled = false;
    const active: Marmot[] = [];
    for (const m of this.list) {
      const point = { x: m.x, y: heightAt(m.x, m.z), z: m.z };
      const tickDt = this.scheduler.takeBrainDtAt('fx', m, point);
      this.poseDue.set(m, tickDt > 0);
      if (this.scheduler.brainHz('fx', { position: point }) === 0) continue;
      active.push(m);
      const d = Math.hypot(player.x - m.x, player.z - m.z);
      if (think) {
        m.t -= 0.1;
        const seeR = crouched ? 22 : playerSpeed > 5 ? 45 : 35;
        if ((m.state === 0 || m.state === 1) && d < seeR && (m.state === 1 || d < seeR * 0.6)) {
          // spotted: a sentry whistles once for the colony; everyone bolts for the burrow
          if (!whistled && m.state === 1) { whistled = true; this.onWhistle?.(m.x, m.z); }
          m.state = 2; m.t = 3;
        } else if (m.state === 0 && m.t <= 0) {
          if (rng.next() < 0.3) { m.state = 1; m.t = rng.range(4, 9); }
          else { const a = rng.range(0, Math.PI * 2), r = rng.range(0.5, 3); m.tx = m.bx + Math.cos(a) * r; m.tz = m.bz + Math.sin(a) * r; m.t = rng.range(2, 6); }
        } else if (m.state === 1 && m.t <= 0) { m.state = 0; m.t = rng.range(2, 5); }
        else if (m.state === 2 && Math.hypot(m.x - m.bx, m.z - m.bz) < 0.3) { m.state = 3; m.t = rng.range(10, 18); }
        else if (m.state === 3 && m.t <= 0 && d > 25) { m.state = 1; m.t = rng.range(4, 8); }
      }
      // Active colonies retain their authored motion step; paused time is never replayed.
      const run = m.state === 2;
      const tx = run || m.state === 3 ? m.bx : m.tx, tz = run || m.state === 3 ? m.bz : m.tz;
      const dx = tx - m.x, dz = tz - m.z, dd = Math.hypot(dx, dz);
      if (dd > 0.05 && m.state !== 1) {
        const sp = Math.min(dd, (run ? 3.5 : 0.35) * dt);
        m.x += (dx / dd) * sp; m.z += (dz / dd) * sp;
        m.yaw = Math.atan2(dx, dz);
      }
      m.stand += ((m.state === 1 ? 1 : 0) - m.stand) * Math.min(1, dt * 6);
      m.sink += ((m.state === 3 ? 1 : 0) - m.sink) * Math.min(1, dt * 5);
    }
    if (whistled) for (const m of active) if (m.state === 0 || m.state === 1) { m.state = 2; m.t = 3; }
    this.write(true);
// END SHIPPING UPDATE
  }
  private write(_scheduled: boolean): void { /* draw is outside this decision oracle */ }
  pose(index: number): boolean { const row=this.list[index]; return row !== undefined && this.poseDue.get(row) === true; }
  state() { return { rows:this.list, acc:this.acc, rng:this.rng.snapshot() }; }
  static scatter(seed: number,n:number,box:{x0:number;x1:number;z0:number;z1:number},ground:MarmotGround): {x:number;z:number}[] {
    const normalAt=(x:number,z:number):readonly[number,number,number]=>[0,ground.normalY(x,z),0];
    const rng = new Rng(seed ^ 0x1717), out: { x: number; z: number }[] = [];
    for (let i = 0; i < n * 20 && out.length < n; i++) {
      const x = rng.range(box.x0, box.x1), z = rng.range(box.z0, box.z1);
      if (!inChunk(x, z, 20) || normalAt(x, z)[1] < 0.93) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 25)) continue;
      out.push({ x, z });
    }
    return out;
  }
}
function inChunk(x:number,z:number,margin=0): boolean { return Math.abs(x)<=250-margin && Math.abs(z)<=250-margin; }
