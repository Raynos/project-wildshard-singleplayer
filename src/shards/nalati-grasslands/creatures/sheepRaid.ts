import { app } from '@wildshard/engine/app/runtime';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { TIER } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';

import * as THREE from 'three';


import type { Wildlife } from './wildlife';
import type { SheepPrey, Flock } from './flock';
import { Pack, type PackController } from '../runtime/groupRegistry';
import type { RaidClockPorts } from './raidClock';
import { enteredOwner } from '@wildshard/engine/app/ownership';
import { NalatiRaidDirector, prepareNalatiRaidDirector } from '../runtime/raidDirector';
import { horseBones } from '../species/horse';
import { shepherdMotion, type ShepherdState } from './shepherdRule';
import { bakedActorGeometry } from '../world/placeBake';





/**
 * Wolves raiding the flock, and the mounted shepherd who rides out to defend it (NALATI-FINISH B1, N13 — the archived
 * Nalati plan's "wolves raiding the sheep + a mounted shepherd"; locked in, E331).
 *
 * The raid: every 6–9 minutes (the first 2.5–4 min in), while you are within 220 m of the pasture to see it, a small
 * valley pack — three wolves that den in the valley's west end, 85 m past the pasture (Kokbori's pack on the NE rim can't
 * reach the flock: the Kunes lies between) — is sent after the sheep nearest it (`Pack.raid`, `Flock.prey`). It is spawned
 * with the first raid (nothing more loads or draws before), and again only if you killed it (at most twice a session);
 * between raids it roams round its den like any pack, and hunts you if it finds you. It runs in, rings the flock and
 * lunges; a bite kills a sheep. The flock panics and bunches, the collie barks at the wolves (Flock.ts, as before). A toast
 * calls it: "Wolves are raiding the flock".
 *
 * The shepherd: Dauren's brother on a saddled bay — a seated herder in the camp people's painterly style (a fur tymaq, a
 * coat, a qamshy whip) on an ordinary camp horse (`mem.owned`: no herd AI, can't die, never aimed at). He walks a slow ring
 * round the flock; any wolf within 50 m of it and he gallops at it, and within 4 m he cracks the whip — the wolf yelps,
 * staggers and breaks off its lunge; the second crack breaks the pack (Pack.scare: it flees and leaves the flock alone).
 * You can ride in with him and shoot them first. He rides back to the flock after.
 *
 *   const raid = new SheepRaid({ animals, wildlife, toast });   // src/shards/nalati-grasslands/ride/ride.ts, once the animals exist
 *   raid.update(dt, playerPosition)                             // every frame
 *   raid.start(true)                                            // a raid now (a test / capture): false if no pack can go
 *   raid.raiding / raids / taken / drivenOff / cracks           // for the checks
 *
 * Cost: one more horse (a skinned draw + its shadow inside the shadow range) and the rider (one static mesh on its body
 * bone, the shared painterly material, ~6 k tris; no shadow on the phone). No physics body of its own beyond the
 * horse's creature capsule.
 */

export interface SheepRaidCtx {
  animals: AnimalManager;
  wildlife: Wildlife;
  toast: (text: string) => void;
}

/** the rider's seat on the horse's body bone (horse.ts SADDLE_LOCAL; +z = the horse's forward, +x its left) */
const SEAT = new THREE.Vector3(0, 0.36, 0.28);
const SHOULDER_R = new THREE.Vector3(-0.2, 0.6, 0.0);
const FIRST_RAID: readonly [number, number] = [150, 240], NEXT_RAID: readonly [number, number] = [360, 540];
const WATCH = 220;                     // m from the flock you must be for a raid to start (it is there to be seen)
const MIN_FLOCK = 20;                  // no raid once the flock is down to this many
const CRACK_CD = 1.3, CRACKS_TO_BREAK = 2;
/** the valley pack's den from the flock (m) and its wolves; spawned at most this many times a session */
const DEN = { dx: -80, dz: -8 }, RAIDERS = ['grey', 'tawny', 'scout'], MAX_PACKS = 2;
type AnimalSound = Parameters<NonNullable<AnimalManager['onSound']>>[0];
const voice = (name: string): AnimalSound => name;
const rand = (r: readonly [number, number]): number => r[0] + app.rng.stream('ai').next() * (r[1] - r[0]);

// ── the shepherd, seated (seat space: origin on the saddle, +y up, +z forward, +x his LEFT — the camp people's frame) ──
/** the shepherd in the saddle (seated at SEAT on a horse's body bone): his body and the whip arm, one painterly material —
 *  the camp's rider (SheepRaid) and the Model Explorer's (src/shards/nalati-grasslands/models/people.ts, E315 M5) */
export function shepherdRider(): { rider: THREE.Group; arm: THREE.Mesh } {
  const mat = painterlyMaterial(null, { rim: 0.4, bands: 0.8 });
  const rider = new THREE.Group();
  rider.name = 'nalati-shepherd';
  const body = new THREE.Mesh(bakedActorGeometry('shepherd-body'), mat);
  const arm = new THREE.Mesh(bakedActorGeometry('shepherd-arm'), mat);
  arm.position.copy(SHOULDER_R);
  rider.add(body, arm);
  rider.position.copy(SEAT);
  for (const m of [body, arm]) { m.castShadow = TIER !== 'phone'; m.receiveShadow = true; }
  return { rider, arm };
}

export class SheepRaid {
  readonly shepherd: Animal | null = null;
  raiding = false;
  raids = 0; taken = 0; drivenOff = 0; cracks = 0;
  private raidT = rand(FIRST_RAID);
  private raidPlayer: THREE.Vector3 | null = null;
  private raidDirector: NalatiRaidDirector | null = null;
  private readonly raidClock: RaidClockPorts = this.clockPorts();
  private pack: PackController | null = null;
  /** the valley pack (spawned with the first raid) and how many have been spawned */
  private raiders: PackController | null = null;
  private spawned = 0;
  private prey: SheepPrey | null = null;
  private pendingT = 0;
  private crackCd = 0; private crackT = -1; private cracksNow = 0;
  private patrolA = 0; private restT = 0;
  private readonly motionState: ShepherdState = { crackCd: 0, patrolA: 0, restT: 0 };
  private readonly nextAi = (): number => app.rng.stream('ai').next();
  private readonly arm: THREE.Mesh | null = null;
  private readonly rider: THREE.Group | null = null;
  private lean = 0;

  constructor(private readonly ctx: SheepRaidCtx) {
    const f = this.flock;
    if (f === null) return;
    const x = f.cx + 12, z = f.cz + 16;
    if (!inChunk(x, z, 10)) return;
    const h = ctx.animals.spawn('horse', x, z, Math.atan2(f.cx - x, f.cz - z), 'camp-bay');
    h.mem['owned'] = 1;            // no herd AI, can't die, never aimed at (Herd.ts, main's aim list, Combat.ts)
    h.label = 'Shepherd\'s horse';
    this.shepherd = h;
    // the rider on the horse's body bone (the ghost riders' way — ghostRiders.ts), one mesh + the whip arm
    const { rider, arm } = shepherdRider();
    try { horseBones(h).body.add(rider); } catch { /* not a horse rig: no rider drawn */ }
    this.rider = rider; this.arm = arm;
  }

  get flock(): Flock | null { return this.ctx.wildlife.flocks[0] ?? null; }

  /** send the pack after the flock now (`force`: whoever is watching — a test / capture); false if no pack can go */
  start(force = false, playerPos?: THREE.Vector3): boolean {
    const f = this.flock;
    if (f === null || this.raiding || f.alive < MIN_FLOCK) return false;
    // a practice room over the pasture (a playground, the arena: the same x / z, 1–3 km up) is not watching it (E321 / E328)
    if (!force && (practiceRoom.open || playerPos === undefined || Math.hypot(playerPos.x - f.cx, playerPos.z - f.cz) > WATCH)) return false;
    const pack = this.raidPack(f);
    const lead = pack?.alpha?.alive === true ? pack.alpha : pack?.members.find((w) => w.alive) ?? null;
    if (pack === null || lead === null) return false;
    const i = f.nearest(lead.position.x, lead.position.z);
    if (i === -1) return false;
    const prey = f.prey(i);
    if (!pack.raid(prey)) return false;
    this.pack = pack; this.prey = prey; this.raiding = true; this.pendingT = 2; this.raids++; this.cracksNow = 0;
    this.ctx.toast('Wolves are raiding the flock — the shepherd rides out');
    return true;
  }

  /** the valley pack, roaming and able (spawned now if there is none, or you killed it) — null if it is busy */
  private raidPack(f: Flock): PackController | null {
    let p = this.raiders;
    if ((p === null || p.alive < 2) && this.spawned < MAX_PACKS) {
      const x = f.cx + DEN.dx, z = f.cz + DEN.dz;
      if (!inChunk(x, z, 20)) return null;
      p = this.ctx.wildlife.spawnPack(x, z, RAIDERS);
      p.findPrey = undefined;   // the flock is its prey, never the herds' foals
      this.raiders = p; this.spawned++;
    }
    return p !== null && p.alive > 1 && p.phase === 'roam' ? p : null;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const director = this.raidDirector;
    if (director === null) throw new Error('Nalati raid director is not admitted');
    this.raidPlayer = playerPos;
    director.advance(dt);
    this.ride(dt);
  }

  /** Admit rows before gameplay; the actual ride owner advances them before its native shepherd motion. */
  async installDirector(player: () => THREE.Vector3): Promise<void> {
    if (this.raidDirector !== null) throw new Error('Nalati raid director already admitted');
    const owner = enteredOwner();
    const create = await prepareNalatiRaidDirector();
    if (owner?.disposed === true) throw new Error('Nalati raid owner was disposed during admission');
    this.raidPlayer = player();
    this.raidDirector = new NalatiRaidDirector(create(app.rng.seedValue), this.raidClock);
  }

  private clockPorts(): RaidClockPorts {
    const raid = () => this;
    return {
      get raiding() { return raid().raiding; }, set raiding(value) { raid().raiding = value; },
      get raidT() { return raid().raidT; }, set raidT(value) { raid().raidT = value; },
      get pendingT() { return raid().pendingT; }, set pendingT(value) { raid().pendingT = value; },
      get present() { return raid().pack !== null && raid().prey !== null; },
      get tracking() { const pack = raid().pack; return pack !== null && pack.prey === raid().prey; },
      get broken() { return raid().pack?.phase === 'break'; },
      get preyAlive() { return raid().prey?.alive === true; },
      get cracked() { return raid().cracksNow > 0; },
      start: () => raid().start(false, raid().raidPlayer ?? undefined), next: () => rand(NEXT_RAID),
      taken: () => { raid().taken++; raid().ctx.toast('The wolves took a sheep'); },
      drivenOff: () => { raid().drivenOff++; raid().ctx.toast('The shepherd drove the wolves off'); },
    };
  }

  /** the shepherd: a slow ring round the flock; at any wolf near it, a gallop and the whip */
  private ride(dt: number): void {
    const h = this.shepherd, f = this.flock;
    if (h === null || f === null || !h.alive) return;
    const state = this.motionState;
    state.crackCd = this.crackCd; state.patrolA = this.patrolA; state.restT = this.restT;
    const motion = shepherdMotion(state, dt, h, f, this.ctx.wildlife.livingWolves, this.nextAi);
    if (motion === null) return;
    this.crackCd = state.crackCd; this.patrolA = state.patrolA; this.restT = state.restT;
    const { speed, yaw, turn, crack } = motion;
    if (crack !== null) this.crack(crack.wolf, crack.dx, crack.dz);
    h.state = speed > 6 ? 'flee' : speed > 0.2 ? 'wander' : Math.sin(app.clock.now * 0.3 + h.seed * 5) > 0.3 ? 'graze' : 'idle';
    h.setMotion(yaw, speed, turn);
    // the rider leans into a gallop; the whip arm swings up and cracks down
    this.lean += ((h.speed > 9 ? 0.28 : h.speed > 5 ? 0.12 : 0) - this.lean) * Math.min(1, dt * 3);
    if (this.rider !== null) this.rider.rotation.x = this.lean;
    if (this.arm !== null) {
      let ax = -0.2;
      if (this.crackT >= 0) {
        this.crackT += dt;
        const u = this.crackT / 0.45;
        ax = u < 0.45 ? -0.2 - 2.4 * (u / 0.45) : -2.6 + 3.2 * Math.min(1, (u - 0.45) / 0.3);
        if (u >= 1) this.crackT = -1;
      }
      this.arm.rotation.x = ax;
    }
  }

  /** the whip on a wolf (dir = from the shepherd to it): a yelp, a stagger, the lunge broken off; the second breaks the pack */
  private crack(wolf: Animal, dx: number, dz: number): void {
    this.crackCd = CRACK_CD; this.crackT = 0; this.cracks++; this.cracksNow++;
    wolf.stagger(new THREE.Vector3(dx, 0, dz), 0.8);
    wolf.cancelAttack();
    wolf.mem['lunge'] = 3; wolf.mem['lt'] = 1.1;
    this.ctx.animals.onSound?.(voice('wolf_yelp'), wolf.position);
    if (this.cracksNow % CRACKS_TO_BREAK === 0) Pack.of(wolf)?.scare(wolf.position.x, wolf.position.z, 25);
  }
}

function inChunk(x: number, z: number, margin = 0): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }
