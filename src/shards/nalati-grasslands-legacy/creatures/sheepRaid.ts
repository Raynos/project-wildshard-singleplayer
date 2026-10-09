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
import { legacyRaidTick, type RaidClockPorts } from './raidClock';
import { installRaidDirector } from './raidDirector';
import { horseBones } from '../species/horse';
import { shepherdMotion, type ShepherdState } from './shepherdRule';
import { PaintKit, v3 } from '../world/paint';
import { pole, lathe } from '@wildshard/engine/world/geometryKit';





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
const C = {
  skin: '#c89066', skinDark: '#a8704c', hair: '#2a211c', black: '#1c1a1a', boot: '#2a1d16', trousers: '#39373e',
  coat: '#6b5a3a', gold: '#d2a646', red: '#b5302a', shirt: '#ece4d2', fur: '#8c6a47', tymaqTop: '#1f5a7a', wood: '#6e4a2c',
};
const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 12, h = 9): THREE.BufferGeometry => new THREE.SphereGeometry(r, w, h).scale(sx, sy, sz);

function shepherdBody(): THREE.BufferGeometry {
  const b = new PaintKit(0x5e9d);
  for (const s of [-1, 1]) {
    b.add(pole(v3(s * 0.1, 0.04, 0.0), v3(s * 0.2, -0.06, 0.3), 0.075, 0.07, 8), C.trousers);                 // thighs over the saddle
    b.add(pole(v3(s * 0.2, -0.06, 0.3), v3(s * 0.25, -0.5, 0.22), 0.07, 0.065, 8), C.boot);                  // tall boots down the flanks
    b.add(sphere(0.06, 1, 0.7, 1.6).translate(s * 0.25, -0.54, 0.29), C.boot);
  }
  // the chapan: a seated torso, its skirt draped over the saddle, a red sash
  b.add(lathe([[0.001, -0.02], [0.23, -0.02], [0.22, 0.18], [0.2, 0.36], [0.22, 0.52], [0.17, 0.62], [0.08, 0.68], [0.001, 0.69]], 20),
    (p) => { const a = Math.abs(Math.atan2(p.x, p.z)); return a < 0.2 && p.y > 0.36 ? C.shirt : a < 0.42 && a >= 0.2 ? C.gold : C.coat; }, { foot: 0.85 });
  b.add(lathe([[0.2, 0.12], [0.3, -0.02], [0.34, -0.14], [0.001, -0.14]], 18).scale(1, 1, 1.25), C.coat, { foot: 0.8 });
  b.add(new THREE.TorusGeometry(0.21, 0.035, 6, 16).rotateX(Math.PI / 2).translate(0, 0.3, 0), C.red);
  // the left arm forward to the reins at the withers
  b.add(pole(v3(0.2, 0.58, 0), v3(0.14, 0.3, 0.3), 0.06, 0.05, 8), C.coat);
  b.add(sphere(0.047).translate(0.12, 0.28, 0.33), C.skin);
  // the head: face, nose, eyes, ears, a moustache and a fur tymaq with ear flaps
  const hy = 0.7;
  b.add(sphere(0.11, 0.92, 1.05, 0.98).translate(0, hy + 0.1, 0.01), C.skin, { brush: 0.05 });
  b.add(sphere(0.022, 0.8, 1, 1.1, 8, 6).translate(0, hy + 0.09, 0.115), C.skinDark);
  for (const s of [-1, 1]) {
    b.add(sphere(0.011, 1, 1, 0.6, 6, 5).translate(s * 0.04, hy + 0.12, 0.105), C.black, { jitter: 0 });
    b.add(sphere(0.055, 0.5, 1.2, 1).translate(s * 0.125, hy + 0.08, -0.01), C.fur, { brush: 0.15 });      // ear flaps
  }
  b.add(pole(v3(-0.06, hy + 0.07, 0.108), v3(0.06, hy + 0.07, 0.108), 0.012, 0.012, 5), C.hair);
  b.add(sphere(0.13, 1, 0.75, 1, 12, 8).translate(0, hy + 0.2, -0.005), C.tymaqTop);
  b.add(new THREE.TorusGeometry(0.12, 0.045, 6, 14).rotateX(Math.PI / 2).translate(0, hy + 0.17, 0), C.fur, { brush: 0.15 });
  b.add(sphere(0.07, 1, 0.8, 0.5).translate(0, hy + 0.09, -0.12), C.fur, { brush: 0.15 });
  return b.finish({ ao: false });
}

/** the whip arm, from the right shoulder (its origin) hanging down-forward, the qamshy in the fist */
function shepherdArm(): THREE.BufferGeometry {
  const a = new PaintKit(0x5e9e);
  const hand = v3(0, -0.36, 0.14);
  a.add(pole(v3(0, 0.02, 0), hand, 0.06, 0.05, 8), C.coat);
  a.add(sphere(0.047).translate(hand.x, hand.y - 0.03, hand.z), C.skin);
  const grip = v3(hand.x, hand.y - 0.03, hand.z), tip = v3(hand.x - 0.03, hand.y + 0.05, hand.z + 0.42);
  a.add(pole(grip, tip, 0.014, 0.01, 5), C.wood);
  a.add(pole(tip, v3(tip.x - 0.05, tip.y - 0.45, tip.z + 0.12), 0.006, 0.004, 4), C.boot);                    // the lash
  return a.finish({ ao: false });
}

/** the shepherd in the saddle (seated at SEAT on a horse's body bone): his body and the whip arm, one painterly material —
 *  the camp's rider (SheepRaid) and the Model Explorer's (src/shards/nalati-grasslands/models/people.ts, E315 M5) */
export function shepherdRider(): { rider: THREE.Group; arm: THREE.Mesh } {
  const mat = painterlyMaterial(null, { rim: 0.4, bands: 0.8 });
  const rider = new THREE.Group();
  rider.name = 'nalati-shepherd';
  const body = new THREE.Mesh(shepherdBody(), mat);
  const arm = new THREE.Mesh(shepherdArm(), mat);
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
  private directed = false;
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
    if (!this.directed) this.director(dt, playerPos);
    this.ride(dt);
  }

  /** SF24: pack combat/shepherd recipes remain native; a bounded fixed-step director can own raid timing. */
  async installDirector(context: Parameters<typeof installRaidDirector>[0], player: () => THREE.Vector3): Promise<void> {
    this.directed = await installRaidDirector(context, this.raidClock, () => { this.raidPlayer = player(); }, app.rng.seedValue);
  }

  private director(dt: number, playerPos: THREE.Vector3): void {
    this.raidPlayer = playerPos;
    legacyRaidTick(this.raidClock, dt);
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
