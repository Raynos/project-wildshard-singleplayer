import * as THREE from 'three';
import { SEED, CHUNK_HALF } from '../core/config';
import { Rng } from '../core/rng';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk, waterLevel } from '../world/Heightfield';
import type { Forest } from '../world/Forest';
import type { Sky } from '../world/Sky';
import { AnimalFactory, speciesDef, rollVariant, type AnimalKind, type AnimalStyle } from './AnimalFactory';
import { Animal, damageFor } from './Animal';
import { getActiveChunk } from '../chunks/registry';
import { TIER_CONFIG } from '../core/tier';
import { noReflect } from '../world/Water';

/**
 * AnimalManager — spawns the chunk's huntable wildlife (the active ChunkDef's `fauna` herd plans),
 * runs their AI at 10 Hz (idle / graze / wander / alert / flee / charge / stalk / dead), animates
 * them every frame, and exposes the combat + audio hooks.
 *
 *   const animals = new AnimalManager(scene, sky, forest).build();
 *   game.onUpdate((dt, t) => animals.update(dt, t, player.position, player.sprinting));
 *
 *   animals.raycast(origin, dir, maxDist) → { animal, point, distance, headshot, damage } | null  (result object is reused;
 *                                          `damage` = DAMAGE model (Animal.ts) for that hit: body 32–40 with distance falloff past 40 m, head ×2.5)
 *   animal.applyDamage(amount, hitPoint, dir) → true if it died   (deer 60 hp, boar 100 hp; variants override — Old Ironhide 300)
 *   animals.hit(hit, dir)  — convenience: applyDamage(hit.damage)
 *   animals.disturb(point, strength) — a bolt landed / something loud happened here: animals within
 *                                      impactSpook m bolt, within impactAlert m go alert (Combat calls it on misses)
 *   animals.nearRay(origin, dir, maxDist, tol) → the animal whose head/body passes within `tol` m of the ray (aim assist / "was I aiming at it")
 *   Blood burst + ground decal, sounds, AI reaction and onKill all fire from applyDamage.
 *   animal.fadeOut()  — dissolve a harvested carcass over 1.5 s (animal.hidden afterwards)
 *
 * The hunting loop (DEER_TUNING / BOAR_TUNING below): every animal carries an `awareness` meter 0..1. It rises while the
 * player is inside the SIGHT cone (body heading ± sightCone, out to sightRange — far less while grazing head-down) or
 * inside the HEARING radius (any direction; grows with the player's speed: still < crouch < walk < sprint), and decays
 * otherwise. At `alertAt` the head comes up and the animal FREEZES staring at you for freezeMin..freezeMax s — that is
 * the shot window — then bolts if it still senses you (`boltAt`), or relaxes back to grazing after `relaxAfter` s. It
 * flees at `runSpeed` (faster than a sprinting player) but only until `fleeUntil..fleeUntilMax` m away, then stops, looks
 * back, and grazes again — "wary" (sharper senses) for `waryTime` s. A hit that does not kill bolts it at once. One
 * spooked animal alerts its herd within `herdAlertRadius` m. Boars charge when hit or when the player is within
 * `chargeDist` m. HUNTERS (a species whose HuntTuning has `stalk` — the bear) never bolt: the alert freeze
 * ends in a STALK (walking the player down, huffing) that becomes a charge inside panicDist, and a charge that
 * lands or times out drops back into the stalk after `stalk.rechargeCd` s until the player is `stalk.giveUp` m away.
 *
 * Fur shells: the SHELL_MAX nearest animals within SHELL_DIST m get 4–8 fur-shell layers (SkinnedMeshes
 * sharing the body's geometry + skeleton); nothing changes beyond that distance.
 *   animals.onKill   = (animal) => …
 *   animals.onCharge = (animal, damage) => …          a boar reached the player
 *   animals.onSound  = (name, position) => …          'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal'
 *   animals.animals: Animal[]   animals.alive (count)
 *
 * Species + variants: every kind comes from the species registry (`src/entities/species/<kind>.ts`, see
 * AnimalFactory.ts). Each spawn rolls a VariantDef by weight with the seeded rng — its `scale`, `hp` and `mods`
 * (speed / chargeDist / damageTaken / chargeDamage / relentless) are applied HERE on top of the species'
 * HuntTuning (DEER_TUNING / BOAR_TUNING below stay the untouched baseline; a species may ship its own
 * `tuning`). A 'legendary' variant is capped at ONE alive per kind (the roll falls back to the rare tier).
 * HerdPlan.variants restricts a herd's pool to those ids.
 *
 * Dev helpers: animals.spawn(kind, x, z, yaw, variant?) adds a single animal (no herd AI target) — `variant`
 * is a variant id ('ironhide') or an id list to roll from; omitted = the species' full weighted table.
 * animals.debug = true draws the hit capsules, animals.calm = true stops them reacting to the player.
 */

export interface AnimalHit { animal: Animal; point: THREE.Vector3; distance: number; headshot: boolean; damage: number }
export type AnimalSound = 'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal' | 'bear_growl' | 'bear_roar' | 'bear_hurt';

interface Herd { kind: AnimalKind; cx: number; cz: number; members: Animal[] }

interface Brain {
  timer: number;        // time left in the current state
  tx: number; tz: number; // wander target
  fleeT: number;        // seconds spent fleeing
  fleeUntil: number;    // m from the player at which this animal stops running (seeded per animal)
  chargeCd: number;
  callT: number;
  awareness: number;    // 0..1 sense meter (see DEER_TUNING)
  freeze: number;       // alert: seconds of head-up stare left before it may bolt
  spooked: boolean;     // alert: bolt as soon as the freeze ends, whatever the senses say (herd panic, impact, hit)
  wary: number;         // seconds of sharpened senses left after a scare
  sensed: boolean;      // the player was sensed this think
}

/** One animal kind's hunting-loop numbers. Player speeds for reference: crouch 2.2, walk 4.3, sprint 7.2 m/s. */
export interface HuntTuning {
  hp: number;
  // ── senses ──
  sightRange: number;      // m: a head-up animal notices a MOVING player inside its cone out to here
  sightRangeGraze: number; // m: head down in the grass it sees far less
  sightCone: number;       // rad: half-angle of the cone around the body heading
  hearStill: number; hearCrouch: number; hearWalk: number; hearSprint: number; // m: hearing radius by player speed (any direction)
  noticeRate: number;      // awareness/s at the edge of a sense; up to 2× nearer (× 0.3 for a player standing still in view)
  forgetRate: number;      // awareness/s decay while nothing is sensed
  alertAt: number;         // awareness → head up + freeze
  boltAt: number;          // awareness → run (once the freeze is over)
  // ── alert ──
  freezeMin: number; freezeMax: number; // s: the stare before it may bolt — the shot window
  relaxAfter: number;      // s: alert with nothing sensed → back to grazing
  panicDist: number;       // m: player closer than this → bolt at once, no freeze
  // ── flee ──
  runSpeed: number;        // m/s gallop
  trotSpeed: number;       // m/s once it is nearly far enough
  fleeMinTime: number;     // s: run at least this long
  fleeUntil: number; fleeUntilMax: number; // m from the player where it stops (seeded per animal in this band)
  fleeMaxTime: number;     // s: give up running (edge of the chunk, pond…)
  lookBack: number;        // s: stopped after the run, looking back at you, before grazing again
  waryTime: number; waryBoost: number; // s of sharper senses after a scare, and the multiplier
  // ── herd ──
  herdAlertRadius: number; // m: a spooked animal alerts herd-mates within this
  herdBoltDelayMin: number; herdBoltDelayMax: number; // s: herd-mates bolt this long after it
  // ── disturbances (a bolt landing nearby) ──
  impactSpook: number;     // m: bolt now
  impactAlert: number;     // m: head up (a HUNTER also engages from this far: it heard the shot)
  // ── hunters (bear): the alert turns into a pursuit ('stalk') instead of a bolt ──
  stalk?: {
    detect: number;      // m: the player inside this radius is noticed at once, any direction (it smells you)
    speed: number;       // m/s of the stalk — a deliberate walk toward the player
    giveUp: number;      // m: a stalking animal this far from the player loses interest
    rechargeCd: number;  // s between a charge (contact or timeout) and the next
    huffMin: number; huffMax: number; // s between huffs (the species' `call` sound) while stalking
    roar: string;        // AnimalSound played at the start of a charge
    fleeBelowHp: number; // hp fraction under which a hit may make a NON-relentless variant break off and flee
    fleeChance: number;  // probability of that break-off per hit
  };
}

export const DEER_TUNING: HuntTuning = {
  hp: 60,
  // Huntable, not paranoid (user: "I need to be able to get close and shoot them"): head-on a deer notices you
  // walking at ~22 m; from behind / the side you get to ~12 m on foot. Only sprinting inside 24 m is heard.
  sightRange: 30, sightRangeGraze: 14, sightCone: THREE.MathUtils.degToRad(55),
  hearStill: 3, hearCrouch: 6, hearWalk: 12, hearSprint: 24,
  noticeRate: 0.3, forgetRate: 0.3, alertAt: 0.45, boltAt: 1.0,
  // 4–7 s head-up stare: plenty of time to raise the crossbow and take the shot
  freezeMin: 4.0, freezeMax: 7.0, relaxAfter: 3.5, panicDist: 6,
  // gallop 6.0 (you sprint 7.2 — you CAN close on one) and only to 35–50 m, then it trots, stops and looks back
  runSpeed: 6.0, trotSpeed: 3.2, fleeMinTime: 1.5, fleeUntil: 35, fleeUntilMax: 50, fleeMaxTime: 8, lookBack: 2.5,
  waryTime: 10, waryBoost: 1.2,
  herdAlertRadius: 8, herdBoltDelayMin: 0.4, herdBoltDelayMax: 1.2,
  impactSpook: 4, impactAlert: 10,
};

export const BOAR_TUNING: HuntTuning = {
  hp: 100,
  // poor eyes, good nose: a short cone but it hears a walker from 22 m
  sightRange: 22, sightRangeGraze: 14, sightCone: THREE.MathUtils.degToRad(60),
  hearStill: 4, hearCrouch: 7, hearWalk: 14, hearSprint: 28,
  noticeRate: 0.5, forgetRate: 0.2, alertAt: 0.35, boltAt: 1.0,
  freezeMin: 1.5, freezeMax: 2.8, relaxAfter: 4, panicDist: 10, // panicDist doubles as the charge trigger
  runSpeed: 6.8, trotSpeed: 3.6, fleeMinTime: 2, fleeUntil: 40, fleeUntilMax: 60, fleeMaxTime: 10, lookBack: 2,
  waryTime: 20, waryBoost: 1.5,
  herdAlertRadius: 12, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.7,
  impactSpook: 7, impactAlert: 18,
};

const DEER_WALK = 1.3, BOAR_WALK = 1.1, BOAR_CHARGE = 7.5, CHARGE_HIT_DIST = 1.4;   // species defaults (SpeciesDef.walkSpeed / chargeSpeed override)
const CHARGE_WHEN_HIT_DIST = 25;   // a wounded boar this close turns on you instead of running
const ANIM_LOD = 140;
const SHELL_DIST = 18, SHELL_MAX = 4;   // fur shells: nearest SHELL_MAX animals within SHELL_DIST m

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

export class AnimalManager {
  group = new THREE.Group();
  animals: Animal[] = [];
  herds: Herd[] = [];
  factory: AnimalFactory;
  onKill?: (animal: Animal) => void;
  onCharge?: (animal: Animal, damage: number) => void;
  onSound?: (name: AnimalSound, position: THREE.Vector3) => void;
  /** every non-lethal AND lethal hit: amount actually dealt, world hit point, whether it was the head (Combat draws the numbers) */
  onDamage?: (animal: Animal, amount: number, hitPoint: THREE.Vector3, headshot: boolean, died: boolean) => void;
  debug = false;
  /** dev: animals ignore the player (no alert / flee) */
  calm = false;
  private brains = new Map<Animal, Brain>();
  private rng = new Rng(SEED + 31);
  private thinkAcc = 0;
  private blood!: BloodFX;
  private debugMeshes: THREE.Mesh[] = [];
  private playerPos = new THREE.Vector3();
  private playerPrev = new THREE.Vector3(); private playerSpeed = 0; private playerInit = false;
  private shellDist = new Float64Array(SHELL_MAX);
  private shellIdx = new Int32Array(SHELL_MAX);

  /** `opts.style` forces the render style (dev harness); production reads `ChunkDef.style` ('pbr' | 'lowpoly') */
  constructor(private scene: THREE.Scene, private sky: Sky, private forest: Forest, opts: { style?: AnimalStyle } = {}) {
    this.factory = new AnimalFactory(sky, { style: opts.style ?? getActiveChunk().style ?? 'pbr' });
    this.group.name = 'animals';
  }

  get alive() { let n = 0; for (const a of this.animals) if (a.alive) n++; return n; }

  build() {
    this.blood = new BloodFX(this.sky);
    this.group.add(this.blood.group);
    this.spawnHerds();
    if (!TIER_CONFIG.reflectDetail) noReflect(this.group);
    this.scene.add(this.group);
    return this;
  }

  // ── spawning ───────────────────────────────────────────────────────────────────────────

  /** dry ground: above the pond's water line */
  private isDry(x: number, z: number) { return heightAt(x, z) > waterLevel() + 0.25; }

  /**
   * Ground an animal can stand on. `clearingR` > 3 asks for a clearing (few trunks in that radius);
   * `canopy` instead asks for trees around (boars root under the canopy).
   */
  private isOpen(x: number, z: number, clearingR: number, canopy = false) {
    if (!inChunk(x, z, 22)) return false;
    if (trailDistance(x, z) < (clearingR > 3 ? 9 : 6)) return false;
    if (cabinMask(x, z) > 0) return false;
    if (normalAt(x, z)[1] < 0.8) return false;
    if (!this.isDry(x, z)) return false;
    const near = this.forest.nearby(x, z, clearingR).length;
    if (clearingR > 3) return canopy ? near >= 3 : near <= 2;
    return near === 0;
  }

  private spawnHerds() {
    const rng = this.rng;
    // herd placement comes from the shard: each HerdPlan asks for a clearing (or canopy) in a band of
    // distances off the trails, optionally in a ring around an anchor (a trail, a cabin…).
    const { fauna: plan, spawn } = getActiveChunk();
    const centres: [number, number][] = [];
    for (const h of plan) {
      let cx = 0, cz = 0, ok = false;
      // herd centres keep 60 m apart when the shard leaves placement to us; an anchored plan already says where
      // it wants to be (a laid-out grid of small groups, `src/chunks/fauna-layout.ts`), so only its own ring size
      // — never less than 20 m — separates it from its neighbours
      const sep = h.anchor ? Math.min(60, Math.max(20, h.anchor.rMax)) : 60;
      for (let tries = 0; tries < 1500 && !ok; tries++) {
        if (h.anchor) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(h.anchor.rMin, h.anchor.rMax);
          cx = h.anchor.x + Math.cos(ang) * r; cz = h.anchor.z + Math.sin(ang) * r;
        } else { cx = rng.range(-215, 215); cz = rng.range(-215, 215); }
        // relax the trail band and clearing size as the search goes on
        const relax = tries / 1500;
        const td = trailDistance(cx, cz);
        if (td < h.trailBand[0] || td > h.trailBand[1] + relax * 60) continue;
        if (!this.isOpen(cx, cz, h.canopy ? 9 : 7 - relax * 3, h.canopy)) continue;
        if (Math.hypot(cx - spawn.x, cz - spawn.z) < 30) continue;         // not on top of the spawn point
        if (centres.some(([x, z]) => Math.hypot(x - cx, z - cz) < sep)) continue;
        ok = true;
      }
      if (!ok) continue;
      centres.push([cx, cz]);
      const herd: Herd = { kind: h.kind, cx, cz, members: [] };
      this.herds.push(herd);
      for (let i = 0; i < h.count; i++) {
        let px = cx, pz = cz, placed = false;
        for (let tries = 0; tries < 60 && !placed; tries++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(1.5, 9);
          px = cx + Math.cos(ang) * r; pz = cz + Math.sin(ang) * r;
          if (!this.isOpen(px, pz, 1.2)) continue;
          if (herd.members.some((m) => Math.hypot(m.position.x - px, m.position.z - pz) < 1.8)) continue;
          placed = true;
        }
        if (!placed) continue;
        const a = this.spawn(h.kind, px, pz, rng.range(0, Math.PI * 2), h.variants);
        a.herd = this.herds.length - 1;
        herd.members.push(a);
      }
    }
  }

  /** the species' hunting-loop numbers: its own `tuning`, else the manager's baseline for its temperament */
  private tuningFor(a: Animal): HuntTuning {
    const sp = speciesDef(a.kind);
    return sp.tuning ?? (sp.aggressive ? BOAR_TUNING : DEER_TUNING);
  }

  /** true if a living legendary of this kind is already in the chunk (the cap is one per kind) */
  private hasLegendary(kind: AnimalKind) {
    for (const a of this.animals) if (a.kind === kind && a.rarity === 'legendary' && a.alive) return true;
    return false;
  }

  /**
   * Add one animal (also used by the dev showcase). `variant`: a variant id (exact, even a second legendary),
   * an id list to roll from by weight, or nothing for the species' whole table.
   */
  spawn(kind: AnimalKind, x: number, z: number, yaw: number, variant?: string | string[]): Animal {
    const sp = speciesDef(kind);
    const v = typeof variant === 'string' ? sp.variants.find((d) => d.id === variant) ?? sp.variants[0] : rollVariant(sp, this.rng, variant, this.hasLegendary(kind));
    const model = this.factory.model(kind, v.id);
    const scale = this.rng.range(v.scale[0], v.scale[1]);
    const rig = this.factory.instantiate(model, this.rng.next());
    const a = new Animal(rig, model, this.rng.next(), scale);
    a.maxHp = a.hp = v.hp ?? this.tuningFor(a).hp;
    a.place(x, z, yaw);
    a.herd = -1;
    a.onFootfall = this.footfall;
    a.onDamaged = this.damaged;
    if (model.shells.length) a.makeShells = () => this.factory.createShells(rig, model);   // none in 'lowpoly'
    a.prepareMaterial = (m) => this.sky.setupMaterial(m);
    a.sampleTerrain();
    this.group.add(a.mesh);
    this.animals.push(a);
    const tune = this.tuningFor(a);
    this.brains.set(a, {
      timer: this.rng.range(1, 4), tx: x, tz: z, fleeT: 0, fleeUntil: this.rng.range(tune.fleeUntil, tune.fleeUntilMax), chargeCd: 0,
      callT: this.rng.range(10, 60), awareness: 0, freeze: 0, spooked: false, wary: 0, sensed: false,
    });
    return a;
  }

  private footfall = (a: Animal, strength: number) => {
    if (!this.onSound) return;
    if (a.position.distanceToSquared(this.playerPos) > 35 * 35) return;
    if (strength > 0.5) this.onSound('hoofsteps', a.position);
  };

  // ── per frame ──────────────────────────────────────────────────────────────────────────

  update(dt: number, t: number, playerPos: THREE.Vector3, playerSprinting = false) {
    this.playerPos.copy(playerPos);
    // AI at 10 Hz, staggered across animals so the cost is flat
    this.thinkAcc += dt;
    const n = this.animals.length;
    if (this.thinkAcc >= 0.1) {
      this.thinkAcc -= 0.1;
      // the player's ground speed (m/s) is the noise they make: still / crouch / walk / sprint
      if (!this.playerInit) { this.playerPrev.copy(playerPos); this.playerInit = true; }
      const moved = Math.hypot(playerPos.x - this.playerPrev.x, playerPos.z - this.playerPrev.z);
      this.playerPrev.copy(playerPos);
      this.playerSpeed += (Math.min(moved / 0.1, 9) - this.playerSpeed) * 0.5;
      for (let i = 0; i < n; i++) this.think(this.animals[i], 0.1, playerPos, playerSprinting);
    }
    // fur shells: pick the SHELL_MAX nearest animals inside SHELL_DIST (tiny insertion sort, no allocs)
    const sd = this.shellDist, si = this.shellIdx;
    sd.fill(Infinity); si.fill(-1);
    for (let i = 0; i < n; i++) {
      const a = this.animals[i];
      if (a.hidden) continue;
      const d2 = a.position.distanceToSquared(playerPos);
      const near = d2 < ANIM_LOD * ANIM_LOD;
      a.update(dt, t, near);
      // draw / shadow distance by tier: a deer at 150 m is a few pixels on a phone, and only near animals shadow
      a.mesh.visible = d2 < TIER_CONFIG.animalHideDist * TIER_CONFIG.animalHideDist;
      a.mesh.castShadow = d2 < TIER_CONFIG.animalShadowDist * TIER_CONFIG.animalShadowDist;
      if (TIER_CONFIG.furShells && d2 < SHELL_DIST * SHELL_DIST) {
        for (let k = 0; k < SHELL_MAX; k++) if (d2 < sd[k]) {
          for (let m = SHELL_MAX - 1; m > k; m--) { sd[m] = sd[m - 1]; si[m] = si[m - 1]; }
          sd[k] = d2; si[k] = i; break;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      let level = 0;
      for (let k = 0; k < SHELL_MAX; k++) if (si[k] === i) { const d = Math.sqrt(sd[k]); level = d < 6 ? 8 : d < 11 ? 6 : 4; }
      this.animals[i].setShellLevel(level);
    }
    this.blood.update(dt);
    if (this.debug) this.updateDebug();
  }

  private think(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean) {
    const br = this.brains.get(a)!;
    if (!a.alive) { a.lookWeight = 0; a.settleCorpse(); return; }
    const rng = this.rng;
    const sp = speciesDef(a.kind);
    const boar = a.aggressive;                    // charges instead of only fleeing
    const T = this.tuningFor(a);
    const M = a.mods;
    const dx = player.x - a.position.x, dz = player.z - a.position.z;
    const dPlayer = Math.hypot(dx, dz);
    br.chargeCd = Math.max(0, br.chargeCd - dt);
    br.wary = Math.max(0, br.wary - dt);
    a.sampleTerrain();

    // ── senses → awareness meter ──
    // sight: inside the cone around the body heading, further when the head is up; a still player is far harder to spot
    const wary = br.wary > 0 ? T.waryBoost : 1;
    const pSpeed = sprinting ? 7.2 : this.playerSpeed;
    let rate = 0;
    if (!this.calm && dPlayer > 0.01) {
      const grazing = a.state === 'graze';
      const sight = (grazing ? T.sightRangeGraze : T.sightRange) * wary;
      if (dPlayer < sight) {
        let rel = Math.atan2(dx, dz) - a.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) < T.sightCone) {
          const still = pSpeed < 0.4 ? 0.3 : pSpeed < 2.6 ? 0.7 : 1;
          rate = Math.max(rate, T.noticeRate * (1 + (1 - dPlayer / sight)) * still);
        }
      }
      // hearing: any direction, radius from the noise the player makes
      const hear = (pSpeed < 0.4 ? T.hearStill : pSpeed < 2.6 ? T.hearCrouch : pSpeed < 5.2 ? T.hearWalk : T.hearSprint) * wary;
      if (dPlayer < hear) rate = Math.max(rate, T.noticeRate * 1.5 * (1 + (1 - dPlayer / hear)));
      if (T.stalk && dPlayer < T.stalk.detect) rate = Math.max(rate, T.noticeRate * 3);   // a hunter smells you
    }
    br.sensed = rate > 0;
    br.awareness = br.sensed ? Math.min(1, br.awareness + rate * dt) : Math.max(0, br.awareness - T.forgetRate * dt);
    const panic = !this.calm && dPlayer < T.panicDist * (boar ? M.chargeDist : 1);   // for chargers this is the charge trigger

    // ambient calls
    br.callT -= dt;
    if (br.callT <= 0) {
      const every = sp.sounds?.callEvery;
      br.callT = every ? rng.range(every[0], every[1]) : rng.range(20, 90);
      // species may limit the call to some variants (elk: only bulls bugle) and it is a CALM sound — not mid-flight
      const caller = !sp.sounds?.callVariants || sp.sounds.callVariants.includes(a.variant);
      if (caller && dPlayer < 80 && a.state !== 'flee' && a.state !== 'charge') this.onSound?.((sp.sounds?.call ?? (boar ? 'boar_grunt' : 'deer_call')) as AnimalSound, a.position);
    }

    const herd = a.herd >= 0 ? this.herds[a.herd] : null;
    // the player is inside the charge distance: chargers charge (hunters stalk while the charge cools down), the rest bolt
    const engage = () => { if (boar && br.chargeCd <= 0) this.enter(a, br, 'charge'); else if (T.stalk) this.enter(a, br, 'stalk'); else { br.spooked = true; this.enter(a, br, 'flee'); } };

    switch (a.state) {
      case 'idle': case 'graze': case 'wander': {
        if (panic) { engage(); break; }
        if (br.awareness >= T.alertAt) { this.enter(a, br, 'alert'); break; }
        br.timer -= dt;
        if (a.state === 'wander') {
          const tdx = br.tx - a.position.x, tdz = br.tz - a.position.z;
          const td = Math.hypot(tdx, tdz);
          if (td < 1.2 || br.timer <= 0) { this.enter(a, br, rng.next() < 0.6 ? 'graze' : 'idle'); break; }
          this.steer(a, Math.atan2(tdx, tdz), sp.walkSpeed ?? (boar ? BOAR_WALK : DEER_WALK), 1.8);
        } else {
          a.setMotion(a.desiredYaw, 0, 1.5);
          if (br.timer <= 0) {
            const r = rng.next();
            if (r < 0.45) this.enter(a, br, 'wander'); else this.enter(a, br, r < 0.8 ? 'graze' : 'idle');
          }
        }
        // a half-noticed player gets glances (awareness creeping up); otherwise the odd look around
        a.lookWeight = br.awareness > 0.12 ? 0.6 : dPlayer < 55 && Math.sin(a.seed * 20 + performance.now() * 0.0004) > 0.7 ? 0.4 : 0;
        a.lookTarget.copy(player);
        break;
      }
      case 'alert': {
        // head up, frozen, staring at you: the shot window
        a.setMotion(a.desiredYaw, 0, 2.0);
        a.lookTarget.copy(player); a.lookWeight = 1;
        br.freeze -= dt;
        if (panic) { engage(); break; }
        if (br.freeze <= 0 && (br.spooked || br.awareness >= T.boltAt)) {
          if (!T.stalk) { this.enter(a, br, 'flee'); break; }
          // a hunter comes for you instead — unless it is nearly dead (it stands and watches), or you are out of reach
          const wounded = !M.relentless && a.hp / a.maxHp < T.stalk.fleeBelowHp;
          if (!wounded && dPlayer < T.impactAlert) this.enter(a, br, 'stalk');
          else { br.spooked = false; br.awareness = Math.min(br.awareness, T.alertAt * 0.5); this.enter(a, br, 'graze'); }
          break;
        }
        if (br.sensed) br.timer = T.relaxAfter;
        else { br.timer -= dt; if (br.timer <= 0) { br.spooked = false; br.awareness = Math.min(br.awareness, T.alertAt * 0.5); this.enter(a, br, 'graze'); } }
        break;
      }
      case 'flee': {
        br.fleeT += dt;
        // run away, biased back toward the herd's side of the map and away from the chunk edge
        let ax = -dx / (dPlayer + 1e-3), az = -dz / (dPlayer + 1e-3);
        if (herd) { const hx = herd.cx - a.position.x, hz = herd.cz - a.position.z, hd = Math.hypot(hx, hz) + 1e-3; if (hd > 25) { ax += hx / hd * 0.35; az += hz / hd * 0.35; } }
        const farEnough = dPlayer > br.fleeUntil;
        const done = br.fleeT > T.fleeMaxTime || (br.fleeT > T.fleeMinTime && farEnough);
        if (done) { this.enter(a, br, 'alert'); br.freeze = T.lookBack; br.spooked = false; br.timer = T.relaxAfter; break; }
        // gallop, easing to a trot for the last stretch
        const speed = (dPlayer > br.fleeUntil * 0.8 && br.fleeT > T.fleeMinTime ? T.trotSpeed : T.runSpeed * (0.92 + 0.08 * Math.sin(a.seed * 9))) * M.speed;
        this.steer(a, Math.atan2(ax, az), speed, 3.5);
        a.lookWeight = 0;
        break;
      }
      case 'stalk': {
        // hunters only: walk the player down, huffing, and charge once inside panicDist (again after rechargeCd)
        const st = T.stalk!;
        if (this.calm || dPlayer > st.giveUp) { br.awareness = 0; br.spooked = false; this.enter(a, br, 'wander'); break; }
        if (panic && br.chargeCd <= 0) { this.enter(a, br, 'charge'); break; }
        this.steer(a, Math.atan2(dx, dz), st.speed * M.speed, 2.5);
        a.lookTarget.copy(player); a.lookWeight = 1;
        br.timer -= dt;
        if (br.timer <= 0) { br.timer = rng.range(st.huffMin, st.huffMax); if (dPlayer < 80) this.onSound?.((sp.sounds?.call ?? 'boar_grunt') as AnimalSound, a.position); }
        break;
      }
      case 'charge': {
        br.timer -= dt;
        this.steer(a, Math.atan2(dx, dz), (sp.chargeSpeed ?? BOAR_CHARGE) * M.speed, 4.0);
        a.lookTarget.copy(player); a.lookWeight = 0.5;
        const after: Animal['state'] = T.stalk ? 'stalk' : 'flee';   // a hunter keeps pressing; a boar wheels away
        if (dPlayer < CHARGE_HIT_DIST * Math.max(1, a.scale)) {
          this.onCharge?.(a, M.chargeDamage);
          this.onSound?.((sp.sounds?.call ?? 'boar_grunt') as AnimalSound, a.position);
          br.chargeCd = T.stalk ? T.stalk.rechargeCd : M.relentless ? 2 : 6;   // Old Ironhide wheels round and comes again
          this.enter(a, br, after);
        } else if (br.timer <= 0) { br.chargeCd = T.stalk ? T.stalk.rechargeCd : M.relentless ? 1.5 : 4; this.enter(a, br, after); }
        break;
      }
      default: break;
    }
    // keep every animal inside the chunk / off steep ground / out of trunks
    this.confine(a);
    if (herd) this.updateHerd(herd);
  }

  private enter(a: Animal, br: Brain, s: Animal['state']) {
    const rng = this.rng;
    const T = this.tuningFor(a);
    const sp = speciesDef(a.kind);
    const from = a.state;
    a.state = s;
    switch (s) {
      case 'idle': br.timer = rng.range(3, 7); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'graze': br.timer = rng.range(6, 14); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'wander': {
        const herd = a.herd >= 0 ? this.herds[a.herd] : null;
        let ok = false;
        for (let i = 0; i < 12 && !ok; i++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(5, 25);
          let tx = a.position.x + Math.cos(ang) * r, tz = a.position.z + Math.sin(ang) * r;
          if (herd) { // stay within ~15 m of the herd centre
            const hx = tx - herd.cx, hz = tz - herd.cz, hd = Math.hypot(hx, hz);
            if (hd > 15) { tx = herd.cx + hx / hd * 14; tz = herd.cz + hz / hd * 14; }
          }
          if (!inChunk(tx, tz, 20) || normalAt(tx, tz)[1] < 0.78 || cabinMask(tx, tz) > 0 || !this.isDry(tx, tz)) continue;
          if (this.forest.nearby(tx, tz, 1.0).length) continue;
          br.tx = tx; br.tz = tz; ok = true;
        }
        if (!ok) { a.state = 'idle'; br.timer = 2; break; }
        br.timer = rng.range(8, 20);
        break;
      }
      case 'alert':
        br.freeze = rng.range(T.freezeMin, T.freezeMax); br.timer = T.relaxAfter;
        a.setMotion(a.desiredYaw, 0, 2);
        if (a.aggressive && rng.next() < 0.5) this.onSound?.((sp.sounds?.call ?? 'boar_grunt') as AnimalSound, a.position);
        // one head coming up makes the herd glance (awareness nudge) — only a BOLT brings every head up (alertHerd)
        if (from !== 'flee' && from !== 'alert') this.alertHerd(a, false);
        break;
      case 'flee':
        br.fleeT = 0; br.fleeUntil = rng.range(T.fleeUntil, T.fleeUntilMax);
        br.wary = T.waryTime; br.awareness = 1; br.spooked = false;
        if (!a.aggressive && rng.next() < 0.3) this.onSound?.((sp.sounds?.call ?? 'deer_call') as AnimalSound, a.position);
        if (from !== 'charge') this.alertHerd(a, true);
        break;
      case 'stalk':
        br.timer = 0.4; br.wary = T.waryTime; br.awareness = 1; br.spooked = false;
        break;
      case 'charge':
        br.timer = a.mods.relentless ? 12 : 4; br.wary = T.waryTime;
        this.onSound?.((T.stalk?.roar ?? sp.sounds?.call ?? 'boar_grunt') as AnimalSound, a.position);
        break;
      default: break;
    }
  }

  /**
   * Herd-mates within herdAlertRadius: `bolt` = one of them is running, so they all come up alert and run too a beat
   * later; otherwise (a head came up) they only get a nudge of awareness — a sentry freezing must not empty the
   * clearing, or there is never a shot.
   */
  private alertHerd(a: Animal, bolt: boolean) {
    if (a.herd < 0) return;
    const T = this.tuningFor(a);
    const r2 = T.herdAlertRadius * T.herdAlertRadius;
    for (const m of this.herds[a.herd].members) {
      if (m === a || !m.alive) continue;
      if (m.position.distanceToSquared(a.position) > r2) continue;
      const mb = this.brains.get(m)!;
      if (m.state === 'flee' || m.state === 'charge' || m.state === 'stalk') continue;
      if (!bolt) { mb.awareness = Math.min(T.alertAt * 0.7, mb.awareness + 0.12); continue; }
      if (m.state !== 'alert') { mb.awareness = Math.max(mb.awareness, T.alertAt); this.enter(m, mb, 'alert'); }
      mb.spooked = true; mb.freeze = Math.min(mb.freeze, this.rng.range(T.herdBoltDelayMin, T.herdBoltDelayMax));
    }
  }

  /**
   * Something loud landed at `point` (a bolt in a tree or the dirt): animals within impactSpook m bolt after a
   * short start, within impactAlert m their heads come up. `strength` scales both radii (1 = a bolt).
   */
  disturb(point: THREE.Vector3, strength = 1) {
    if (this.calm) return;
    for (const a of this.animals) {
      if (!a.alive) continue;
      const T = this.tuningFor(a);
      const d = Math.hypot(point.x - a.position.x, point.z - a.position.z);
      if (d > T.impactAlert * strength) continue;
      const br = this.brains.get(a)!;
      if (a.state === 'flee' || a.state === 'charge' || a.state === 'stalk') continue;
      if (a.state !== 'alert') { br.awareness = Math.max(br.awareness, T.alertAt); this.enter(a, br, 'alert'); }
      if (d < T.impactSpook * strength) { br.spooked = true; br.freeze = Math.min(br.freeze, 0.25); }
      else br.awareness = Math.min(1, br.awareness + 0.3);
    }
  }

  /** desired heading with trunk repulsion, slope + edge avoidance */
  private steer(a: Animal, yaw: number, speed: number, turnRate: number) {
    let vx = Math.sin(yaw), vz = Math.cos(yaw);
    const px = a.position.x, pz = a.position.z;
    const look = 1.5 + speed * 0.45;
    for (const tr of this.forest.nearby(px + vx * look * 0.5, pz + vz * look * 0.5, look)) {
      const ox = px - tr.x, oz = pz - tr.z;
      const d = Math.hypot(ox, oz) + 1e-3;
      const range = tr.r + look;
      if (d < range) { const f = (1 - d / range) * 1.6; vx += ox / d * f; vz += oz / d * f; }
    }
    // steep ground ahead / chunk edge: bend toward the chunk centre
    const ax = px + vx * look, az = pz + vz * look;
    if (!inChunk(ax, az, 22) || normalAt(ax, az)[1] < 0.75 || !this.isDry(ax, az)) {
      const cd = Math.hypot(px, pz) + 1e-3;
      vx += -px / cd * 1.5; vz += -pz / cd * 1.5;
      // and try the perpendiculars
      const sx = -vz, sz = vx;
      const lOk = inChunk(px + sx * look, pz + sz * look, 22) && normalAt(px + sx * look, pz + sz * look)[1] >= 0.75 && this.isDry(px + sx * look, pz + sz * look);
      if (lOk) { vx += sx; vz += sz; } else { vx -= sx; vz -= sz; }
    }
    a.setMotion(Math.atan2(vx, vz), speed, turnRate);
  }

  private confine(a: Animal) {
    const p = a.position;
    if (!this.isDry(p.x, p.z)) {
      // stepped into the pond: back up toward the last dry heading
      p.x -= Math.sin(a.yaw) * 1.0; p.z -= Math.cos(a.yaw) * 1.0;
      a.desiredYaw = a.yaw + Math.PI * 0.75;
    }
    const lim = CHUNK_HALF - 4; // hard clamp; steering keeps AI animals ≥ 20 m from the edge
    if (Math.abs(p.x) > lim) p.x = Math.sign(p.x) * lim;
    if (Math.abs(p.z) > lim) p.z = Math.sign(p.z) * lim;
    for (const tr of this.forest.nearby(p.x, p.z, 0.6)) {
      const ox = p.x - tr.x, oz = p.z - tr.z;
      const d = Math.hypot(ox, oz), min = tr.r + 0.45;
      if (d < min && d > 1e-4) { p.x = tr.x + ox / d * min; p.z = tr.z + oz / d * min; }
    }
  }

  private updateHerd(h: Herd) {
    let x = 0, z = 0, n = 0;
    for (const m of h.members) if (m.alive) { x += m.position.x; z += m.position.z; n++; }
    if (n) { h.cx += (x / n - h.cx) * 0.2; h.cz += (z / n - h.cz) * 0.2; }
  }

  // ── combat ─────────────────────────────────────────────────────────────────────────────

  private hitResult: AnimalHit = { animal: null as unknown as Animal, point: new THREE.Vector3(), distance: 0, headshot: false, damage: 0 };

  /** the DAMAGE model (Animal.ts): a body bolt from `dist` m (falloff past 40 m), ×headMul for the head */
  damageFor(headshot: boolean, dist: number): number { return damageFor(headshot, dist); }

  /**
   * Ray vs every living animal's head sphere + body capsule. Returns the nearest hit
   * (the returned object is reused between calls — copy what you need).
   */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, aliveOnly = true): AnimalHit | null {
    let best = maxDist, bestA: Animal | null = null, bestHead = false;
    for (const a of this.animals) {
      if ((aliveOnly && !a.alive) || a.hidden) continue;
      // broad phase: bounding sphere around the animal
      _c.copy(a.position); _c.y += a.dims.bodyY * a.scale;
      _d.subVectors(_c, origin);
      const tca = _d.dot(dir);
      if (tca < -2 || tca > best + 2) continue;
      const bR = (a.dims.bodyHalfLen + 1.2) * a.scale;
      if (_d.lengthSq() - tca * tca > bR * bR) continue;
      // head
      a.headWorld(_p);
      const th = raySphere(origin, dir, _p, a.dims.headRadius * a.scale);
      if (th >= 0 && th < best) { best = th; bestA = a; bestHead = true; }
      // body capsule
      a.bodyCapsule(_a, _b);
      const tb = rayCapsule(origin, dir, _a, _b, a.dims.bodyRadius * a.scale);
      if (tb >= 0 && tb < best) { best = tb; bestA = a; bestHead = false; }
    }
    if (!bestA) return null;
    const h = this.hitResult;
    h.animal = bestA; h.distance = best; h.headshot = bestHead;
    h.point.copy(origin).addScaledVector(dir, best);
    h.damage = this.damageFor(bestHead, h.point.distanceTo(this.playerPos));
    return h;
  }

  /**
   * The living animal whose head sphere or body capsule passes within `tol` m of the ray (nearest along the ray),
   * or null. Cheap (one closest-point test per animal in range) — Combat asks every frame for the crosshair target.
   */
  nearRay(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, tol: number): Animal | null {
    let best = maxDist, bestA: Animal | null = null;
    for (const a of this.animals) {
      if (!a.alive || a.hidden) continue;
      _c.copy(a.position); _c.y += a.dims.bodyY * a.scale;
      _d.subVectors(_c, origin);
      const t = _d.dot(dir);
      if (t < 0 || t > best) continue;
      const r = (a.dims.bodyHalfLen + a.dims.bodyRadius) * a.scale + tol;
      if (_d.lengthSq() - t * t > r * r) continue;
      // refine against the head sphere and the body capsule
      a.headWorld(_p);
      const rh = a.dims.headRadius * a.scale + tol;
      _d.subVectors(_p, origin); const th = _d.dot(dir);
      let ok = th > 0 && _d.lengthSq() - th * th < rh * rh;
      if (!ok) {
        a.bodyCapsule(_a, _b);
        ok = segRayDist2(origin, dir, _a, _b) < (a.dims.bodyRadius * a.scale + tol) ** 2;
      }
      if (ok) { best = t; bestA = a; }
    }
    return bestA;
  }

  /** Convenience: apply a raycast hit with its modelled damage. Returns true if it died. */
  hit(hit: AnimalHit, dir: THREE.Vector3): boolean {
    return hit.animal.applyDamage(hit.damage, hit.point, dir);
  }

  /** every applyDamage lands here: blood, sounds, AI reaction, kill event */
  private damaged = (a: Animal, amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3, died: boolean) => {
    this.blood.burst(hitPoint, dir, amount >= 80 ? 1.5 : 1);
    const sp = speciesDef(a.kind);
    this.onSound?.((sp.sounds?.hurt ?? (a.aggressive ? 'boar_squeal' : 'deer_call')) as AnimalSound, a.position);
    // headshot = the hit point sits inside the head sphere (a hair of slack for the ray step)
    a.headWorld(_p);
    const headshot = _p.distanceToSquared(hitPoint) < (a.dims.headRadius * a.scale + 0.06) ** 2;
    this.onDamage?.(a, amount, hitPoint, headshot, died);
    const br = this.brains.get(a);
    if (died) { this.onKill?.(a); if (br) br.timer = 0; return; }
    if (br && a.state !== 'charge') {
      // a wounded animal bolts at once — no freeze; a boar this close turns on you instead
      const T = this.tuningFor(a);
      br.wary = T.waryTime;
      const M = a.mods;
      if (T.stalk) {
        // a hunter never runs from a hit — it comes for you from wherever it is (the charge times out into a stalk);
        // only a nearly dead, non-relentless one (a black bear under 20 %) may break off
        if (!M.relentless && a.hp / a.maxHp < T.stalk.fleeBelowHp && this.rng.next() < T.stalk.fleeChance) { br.spooked = true; this.enter(a, br, 'flee'); }
        else { br.chargeCd = 0; this.enter(a, br, 'charge'); }
      } else if (a.aggressive && this.playerPos.distanceTo(a.position) < CHARGE_WHEN_HIT_DIST * M.chargeDist && (br.chargeCd <= 0 || M.relentless) && (M.relentless || this.rng.next() < 0.7)) this.enter(a, br, 'charge');
      else { br.spooked = true; this.enter(a, br, 'flee'); }
    }
  };

  // ── debug ──────────────────────────────────────────────────────────────────────────────

  private updateDebug() {
    if (!this.debugMeshes.length) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, wireframe: true });
      for (const a of this.animals) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(a.dims.headRadius * a.scale, 10, 8), mat);
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(a.dims.bodyRadius * a.scale, a.dims.bodyHalfLen * 2 * a.scale, 4, 10), mat);
        this.debugMeshes.push(h, b); this.group.add(h, b);
      }
    }
    this.animals.forEach((a, i) => {
      const h = this.debugMeshes[i * 2], b = this.debugMeshes[i * 2 + 1];
      a.headWorld(h.position);
      a.bodyCapsule(_a, _b);
      b.position.lerpVectors(_a, _b, 0.5);
      _d.subVectors(_b, _a).normalize();
      b.quaternion.setFromUnitVectors(_c.set(0, 1, 0), _d);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Ray helpers
// ─────────────────────────────────────────────────────────────────────────────────────────

const _oc = new THREE.Vector3(), _ab = new THREE.Vector3(), _ao = new THREE.Vector3();

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number {
  _oc.subVectors(o, c);
  const b = _oc.dot(d), cc = _oc.dot(_oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (cc < 0 ? 0 : -1);
}

/** squared distance between a ray (o, d unit) and a segment a-b (closest points, clamped to the segment and t ≥ 0) */
function segRayDist2(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  _ab.subVectors(b, a); _ao.subVectors(a, o);
  const abab = _ab.dot(_ab), abd = _ab.dot(d), aod = _ao.dot(d), abao = _ab.dot(_ao);
  const den = abab - abd * abd;
  let u = den > 1e-6 ? (abd * aod - abao) / den : 0;            // param on the segment
  u = THREE.MathUtils.clamp(u, 0, 1);
  let t = aod + u * abd;                                        // param on the ray
  if (t < 0) t = 0;
  const px = a.x + _ab.x * u - (o.x + d.x * t), py = a.y + _ab.y * u - (o.y + d.y * t), pz = a.z + _ab.z * u - (o.z + d.z * t);
  return px * px + py * py + pz * pz;
}

/** ray vs capsule (segment a-b, radius r): infinite-cylinder test clipped to the segment, plus the end spheres */
function rayCapsule(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, r: number): number {
  _ab.subVectors(b, a); _ao.subVectors(o, a);
  const abab = _ab.dot(_ab), abd = _ab.dot(d), abao = _ab.dot(_ao), aod = _ao.dot(d), aoao = _ao.dot(_ao);
  const A = abab - abd * abd, B = abab * aod - abao * abd, C = abab * (aoao - r * r) - abao * abao;
  let best = -1;
  if (A > 1e-6) {
    const disc = B * B - A * C;
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / A;
      if (t >= 0) {
        const y = abao + t * abd;
        if (y >= 0 && y <= abab) best = t;
      }
    }
  }
  const ta = raySphere(o, d, a, r), tb = raySphere(o, d, b, r);
  if (ta >= 0 && (best < 0 || ta < best)) best = ta;
  if (tb >= 0 && (best < 0 || tb < best)) best = tb;
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Blood: a pooled particle burst + pooled ground decals
// ─────────────────────────────────────────────────────────────────────────────────────────

function makeDropTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.7, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const MAX_P = 384, MAX_DECALS = 24;

class BloodFX {
  group = new THREE.Group();
  private pos = new Float32Array(MAX_P * 3);
  private vel = new Float32Array(MAX_P * 3);
  private life = new Float32Array(MAX_P);
  private points: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private next = 0;
  private decals: THREE.Mesh[] = [];
  private decalNext = 0;
  private active = 0;

  constructor(sky: Sky) {
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.09, 0.004, 0.003), size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, map: makeDropTexture(), alphaTest: 0.3 });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.group.add(this.points);
    for (let i = 0; i < MAX_P; i++) this.pos[i * 3 + 1] = -1000;
    const dmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.002, 0.002), roughness: 0.35, metalness: 0, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    sky.setupMaterial(dmat);
    const dgeo = new THREE.CircleGeometry(1, 18);
    // irregular splat outline
    const pa = dgeo.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < pa.count; i++) { const k = 0.6 + 0.4 * Math.abs(Math.sin(i * 7.3) * Math.cos(i * 3.1)); pa.setXY(i, pa.getX(i) * k, pa.getY(i) * k); }
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(dgeo, dmat);
      m.visible = false; m.receiveShadow = true; m.renderOrder = 2;
      this.decals.push(m); this.group.add(m);
    }
  }

  burst(at: THREE.Vector3, dir: THREE.Vector3, strength = 1) {
    const n = Math.round(22 * strength);
    for (let i = 0; i < n; i++) {
      const k = this.next; this.next = (this.next + 1) % MAX_P;
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
      // spray mostly along the shot direction (exit) with a wide cone
      const s = 1.5 + Math.random() * 3.5;
      this.vel[k * 3] = (dir.x * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      this.vel[k * 3 + 1] = (dir.y * 0.6 + (Math.random() - 0.2) * 1.2) * s;
      this.vel[k * 3 + 2] = (dir.z * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      this.life[k] = 0.45 + Math.random() * 0.45;
    }
    this.active = Math.min(MAX_P, this.active + n);
    // ground patch
    const d = this.decals[this.decalNext]; this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    const gx = at.x + dir.x * 0.4, gz = at.z + dir.z * 0.4;
    const gy = heightAt(gx, gz);
    const nrm = normalAt(gx, gz);
    d.position.set(gx, gy + 0.015, gz);
    _d.set(nrm[0], nrm[1], nrm[2]);
    d.quaternion.setFromUnitVectors(_c.set(0, 0, 1), _d);
    d.rotateZ(Math.random() * Math.PI * 2);
    const r = 0.14 + Math.random() * 0.14 * strength;
    d.scale.set(r, r * (0.7 + Math.random() * 0.5), 1);
    d.visible = true;
  }

  update(dt: number) {
    if (this.active === 0) return;
    let alive = 0;
    for (let k = 0; k < MAX_P; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -1000; continue; }
      alive++;
      this.vel[k * 3 + 1] -= 9.8 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
    }
    this.active = alive;
    this.posAttr.needsUpdate = true;
  }
}
