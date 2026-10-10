import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackBrain, PackPrey } from '@wildshard/engine/ai/pack';
import type { FlockBrain } from '@wildshard/engine/ai/flock';
import type { SimHost } from '@wildshard/engine/sim';
import { legacyRaidTick, type RaidClockPorts } from '../creatures/raidClock';
import { shepherdMotion, type ShepherdState } from '../creatures/shepherdRule';
import type { NalatiGroups } from './groups';

const finite = v.pipe(v.number(), v.finite()), count = v.pipe(finite, v.integer(), v.minValue(0));
const savedIndex = v.pipe(finite, v.integer(), v.minValue(-1));
const Saved = v.strictObject({ raiding: v.boolean(), raids: count, taken: count, drivenOff: count, cracks: count,
  raidT: finite, pendingT: finite, spawned: v.pipe(count, v.maxValue(2)), cracksNow: count,
  pack: savedIndex, raiders: savedIndex, prey: savedIndex, shepherd: v.strictObject({ crackCd: finite, patrolA: finite, restT: finite }) });

/** SheepRaid's live timer and ring on native bodies. Mesh animation, whip sound and HUD toasts stay on the page. */
export class HeadlessSheepRaid {
  raiding = false;
  raids = 0; taken = 0; drivenOff = 0; cracks = 0;
  raidT: number;
  pendingT = 0;
  private spawned = 0;
  private cracksNow = 0;
  private pack: PackBrain<AnimalSim> | null = null;
  private raiders: PackBrain<AnimalSim> | null = null;
  private prey: PackPrey | null = null;
  private preyIndex = -1;
  readonly shepherd: ShepherdState = { crackCd: 0, patrolA: 0, restT: 0 };
  private readonly clock: RaidClockPorts;
  private readonly dir = new Vector3();
  private readonly ai: () => number;

  private readonly host: SimHost; private readonly groups: NalatiGroups; private readonly flock: FlockBrain | null;
  private readonly horse: AnimalSim | null; private readonly preyAt: (index: number) => PackPrey;
  private readonly spawnPack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>;
  constructor(host: SimHost, groups: NalatiGroups, flock: FlockBrain | null,
    horse: AnimalSim | null, preyAt: (index: number) => PackPrey,
    spawnPack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>) {
    this.host = host; this.groups = groups; this.flock = flock; this.horse = horse; this.preyAt = preyAt; this.spawnPack = spawnPack;
    this.raidT = groups.firstRaid;
    this.ai = () => host.rng.stream('ai').next();
    const raid = () => this;
    this.clock = {
      get raiding() { return raid().raiding; }, set raiding(value) { raid().raiding = value; },
      get raidT() { return raid().raidT; }, set raidT(value) { raid().raidT = value; },
      get pendingT() { return raid().pendingT; }, set pendingT(value) { raid().pendingT = value; },
      get present() { return raid().pack !== null && raid().prey !== null; },
      get tracking() { return raid().pack !== null && raid().pack?.prey === raid().prey; },
      get broken() { return raid().pack?.phase === 'break'; },
      get preyAlive() { return raid().prey?.alive === true; }, get cracked() { return raid().cracksNow > 0; },
      start: this.beginRaid.bind(this), next: () => 360 + host.rng.stream('ai').next() * 180,
      taken: () => { this.taken++; }, drivenOff: () => { this.drivenOff++; },
    };
    const continuation = { snapshot: () => this.snapshot(), restore: (value: unknown) => {
      const saved = v.parse(Saved, value);
      const pack = this.resolvePack(saved.pack), raiders = this.resolvePack(saved.raiders);
      if (saved.prey < -1 || (saved.prey >= 0 && (flock === null || saved.prey >= flock.n))) throw new Error('Unknown Nalati raid sheep');
      this.pack = pack; this.raiders = raiders; this.preyIndex = saved.prey; this.prey = saved.prey === -1 ? null : preyAt(saved.prey);
      this.raiding = saved.raiding; this.raids = saved.raids; this.taken = saved.taken; this.drivenOff = saved.drivenOff; this.cracks = saved.cracks;
      this.raidT = saved.raidT; this.pendingT = saved.pendingT; this.spawned = saved.spawned; this.cracksNow = saved.cracksNow;
      Object.assign(this.shepherd, saved.shepherd);
    } };
    host.onStep('nalati.raid', idleRaidStep, continuation);
  }

  /** The page's start guard; the headless player cannot open a practice room above the pasture. */
  start(force = false): boolean { return this.beginRaid(force); }

  private beginRaid(force = false): boolean {
    const f = this.flock, p = this.host.player.position;
    if (f === null || this.raiding || f.alive < 20 || (!force && Math.hypot(p.x - f.cx, p.z - f.cz) > 220)) return false;
    let pack = this.raiders;
    if ((pack === null || pack.alive < 2) && this.spawned < 2) {
      const x = f.cx - 80, z = f.cz - 8;
      if (Math.abs(x) > 230 || Math.abs(z) > 230) return false;
      pack = this.spawnPack(x, z, ['grey', 'tawny', 'scout']);
      this.raiders = pack; this.spawned++;
    }
    if (pack === null || pack.alive <= 1 || pack.phase !== 'roam') return false;
    const lead = pack.alpha?.alive === true ? pack.alpha : pack.members.find(w => w.alive) ?? null;
    if (lead === null) return false;
    const i = f.nearest(lead.position.x, lead.position.z);
    if (i === -1) return false;
    const prey = this.preyAt(i);
    if (!pack.raid(prey)) return false;
    this.pack = pack; this.prey = prey; this.preyIndex = i; this.raiding = true; this.pendingT = 2; this.raids++; this.cracksNow = 0;
    return true;
  }

  /** Wildlife has advanced first; this runs before the manager's think loop, exactly as Ride.update on the page. */
  update(dt: number, wolves: readonly AnimalSim[]): void {
    legacyRaidTick(this.clock, dt);
    const h = this.horse, motion = shepherdMotion(this.shepherd, dt, h, this.flock, wolves, this.ai);
    if (h === null || motion === null) return;
    const { speed, yaw, turn, crack } = motion;
    if (crack !== null) {
      this.cracks++; this.cracksNow++;
      this.dir.set(crack.dx, 0, crack.dz); crack.wolf.stagger(this.dir, 0.8); crack.wolf.cancelAttack();
      crack.wolf.mem['lunge'] = 3; crack.wolf.mem['lt'] = 1.1;
      if (this.cracksNow % 2 === 0) for (let i = 0; i < 8; i++) {
        const pack = this.groups.packs[i]; if (pack === undefined) break;
        if (pack.members.includes(crack.wolf)) { pack.scare(crack.wolf.position.x, crack.wolf.position.z, 25); break; }
      }
    }
    h.state = speed > 6 ? 'flee' : speed > 0.2 ? 'wander' : Math.sin(this.host.clock.now * 0.3 + h.seed * 5) > 0.3 ? 'graze' : 'idle';
    h.setMotion(yaw, speed, turn);
  }

  snapshot(): v.InferOutput<typeof Saved> {
    return { raiding: this.raiding, raids: this.raids, taken: this.taken, drivenOff: this.drivenOff, cracks: this.cracks,
      raidT: this.raidT, pendingT: this.pendingT, spawned: this.spawned, cracksNow: this.cracksNow,
      pack: this.pack === null ? -1 : this.groups.packs.indexOf(this.pack), raiders: this.raiders === null ? -1 : this.groups.packs.indexOf(this.raiders),
      prey: this.preyIndex, shepherd: { ...this.shepherd } };
  }
  private resolvePack(index: number): PackBrain<AnimalSim> | null {
    if (index === -1) return null;
    const pack = this.groups.packs[index]; if (pack === undefined) throw new Error('Unknown Nalati raid pack'); return pack;
  }
}

// Wildlife calls the director in its original frame position; this adapter only owns its continuation.
function idleRaidStep(): void { /* Decision runs in nalati.creatures, after flock movement. */ }
