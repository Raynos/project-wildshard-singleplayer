import { ironhideGoal, ghostGoal, blackpawGoal, imperialGoal } from './EliteGoals';
import { PINE_LANES } from './strikes';
import { EliteBrain } from '@wildshard/engine/ai/EliteBrain';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { inChunk } from '@wildshard/engine/world/Heightfield';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';
import { GroundTell, type Elites, type EliteDef, type EliteScript } from '@wildshard/game/Elite';
import { BEAR_CAVE } from '../layout';
import { PINE_ELITE_ANIMALS, PINE_ELITE_DEFS, swapRolledElites as swapRolled } from './eliteRoster';
import type { SkinId } from '../loadout/skins';
import { Puffs } from './fxKit';
import { own, release, retire, voice, LaneCharge, type PineCtx } from './ctx';
import { behindPlayer, fadeCooldown, headingTo } from './combatMath';
import { pineEliteStreams, type PineEliteStreams } from './eliteStreams';

/**
 * Pine Hollow's four NAMED ELITES (PINE-HOLLOW-REMASTER PH-C3; Jake's PH-U13). Each is an `EliteScript` over the engine's
 * elite system (src/game/Elite.ts, ported from Nalati: lair + leash, the bar over the head → pinned, phase 2 at 50 %,
 * the banner, the minimap skull, the 20-minute respawn, the first-kill skin orb + a trophy every kill).
 *
 * IDENTITY: an elite is its species' legendary / rare variant placed at a lair — kind + variant, never a mesh — so it
 * wears whatever hull the creature lane gives that variant (PH-M1's generated coats), and the journal (compendium
 * shards/pine-hollow.ts `match`), the trophy wall and the achievements see the kill exactly as before. A herd that
 * rolled one of these variants at boot gets an ordinary one of its kind instead (`swapRolledElites`, eliteRoster.ts): there
 * is one Old Ironhide, and he lives at his lair.
 *
 * AI: the scripts drive their animal from this tick (`own()` in ctx.ts parks it in a state the manager's AI skips), so
 * the species files are untouched:
 *
 *   OLD IRONHIDE, Terror of the Hollow (boar 'ironhide', the SW woods off the S road) — circles you at a trot, then
 *     GORE CHARGE: a red lane paints from him through you (0.9 s, he paws) → 12.5 m/s down it, 30 if you are still in
 *     it → he skids and stands (the window). Phase 2 (BOTH TUSKS NOW): a quicker tell, a faster run, often a second
 *     charge straight after.
 *   THE GHOST STAG, the Pale One (deer 'ghost', the old-growth's E fringe) — flees rather than fights: runs in a circle
 *     round its glade, stops to stare back (the shot). FADE: hit it, or walk up on it, and it goes — a pale burst,
 *     unaimable for 2 s — and comes back BEHIND you 14–18 m off, staring. Phase 2 (NOW YOU DON'T): fades twice as often,
 *     and on its own mid-run.
 *   OLD BLACKPAW, the Den's Landlord (bear 'black-old', the Den) — waits in the cave. AMBUSH: come within ~22 m of the
 *     cave mouth and he bursts out of it roaring. ROAR-STUN: a ring paints round him (1.1 s) → the roar roots anyone
 *     inside it for 1.3 s (12) — step out of the ring. Then a charge lane, or a swipe up close (22). Phase 2 (WOKEN UP
 *     PROPERLY): roars twice as often, and the ring is 11 m, not 8.
 *   THE IMPERIAL BULL, Seven by Seven (elk 'imperial', the N meadow) — postures at 18–26 m and charges down lanes (34).
 *     BUGLE: at dusk and by night (PineDayNight) he stops and bugles, and two rival bulls come in out of the trees 55 m
 *     off and charge you too. Once per phase; phase 2 (FULL VOLUME) bugles again.
 *
 * Drops (cosmetic, the skins are Skins.ts's): IRONHIDE rifle · GHOST STAG crossbow · BLACKPAW crossbow · IMPERIAL
 * crossbow; the trophies go into the pack (Inventory). Kills go through the AnimalManager like any kill (kill feed,
 * Progress, the journal's TAKEN, the trophy wall's mount).
 *
 * Dev: `?elite=ironhide|ghost-stag|blackpaw|imperial-bull` spawns it now whatever its timer and stands you `&from=` m
 * (default 30) off it, facing it; `window.__pineElites` (the Elites + `.force(id, move)` for the evidence captures).
 */

const TELL_RED = new THREE.Color(2.4, 0.75, 0.3);

/** where Blackpaw waits: a step inside the cave mouth (the mouth faces SE: (−sin rot, −cos rot)) */
const MOUTH = { x: BEAR_CAVE.x - Math.sin(BEAR_CAVE.rot) * 1.5, z: BEAR_CAVE.z - Math.cos(BEAR_CAVE.rot) * 1.5 };

/** the boot swap (eliteRoster.ts) through the page's creature manager */
export function swapRolledElites(animals: AnimalManager): number {
  return swapRolled({ bodies: animals.animals, herds: animals.herds, retire: (a) => { retire(animals, a); }, spawn: (kind, x, z, yaw, variants) => animals.spawn(kind, x, z, yaw, variants) });
}

const elitesOwned = new WeakSet<Animal>();
/** one of the named elites (main.ts: its legendary skin comes from the elite's orb, not the kill hook) */
export function isPineElite(a: Animal): boolean { return elitesOwned.has(a); }

interface Env extends PineCtx { elites: () => Elites; puffs: Puffs }

const _v = new THREE.Vector3();

abstract class PineElite extends EliteBrain<Animal> implements EliteScript {
  override mode = 'idle';
  override modeT = 0;
  override p2 = false;
  override setMode(mode: string): void { super.setMode(mode); }
  override toPlayer(a: Animal): { d: number; yaw: number } { return super.toPlayer(a); }
  voice(name: string, a: Animal): void { voice(this.env.animals, name, a.position); }
  next(): number { return this.streams.fight.next(); }
  protected readonly who: (typeof PINE_ELITE_ANIMALS)[string];
  private readonly streams: PineEliteStreams;
  override readonly def: EliteDef;
  constructor(def: EliteDef, readonly env: Env) {
    // the level seed's own streams (eliteStreams.ts), never Math.random or the page's salted ones: the same elite every boot
    const streams = pineEliteStreams(def.id);
    super(def, { player: env.player, random: () => streams.fight.next() }); this.def = def;
    this.streams = streams;
    const who = PINE_ELITE_ANIMALS[def.id];
    if (who === undefined) throw new Error(`pine elite '${def.id}' has no animal`);
    this.who = who;
  }
  override spawn(): void {
    const L = this.def.lair;
    const a = this.env.animals.spawn(this.who.kind, L.x, L.z, this.streams.spawn.next() * Math.PI * 2, this.who.variant);
    own(a); elitesOwned.add(a);
    this.animal = a; this.p2 = false; this.setMode('idle'); this.wx = L.x; this.wz = L.z; this.wanderT = 0;
    pinBrain(a); inspectBrain(a, () => ({ state: this.brainState, picks: [], brainHz: 60, pinned: true }));
    this.onSpawn(a);
  }
  protected onSpawn(_a: Animal): void { /* per elite */ }
  override despawn(): void { this.clearTells(); if (this.animal) retire(this.env.animals, this.animal); this.animal = null; }
  // the trophy is the kill feed's line and the journal's wall (TAKEN), not a pack item: Mott has no use for it (E314 C)
  trophy(): void { this.clearTells(); this.env.feed(`${this.def.drop.trophyName ?? 'Felled'} — ${this.def.name}`); }
  dropModel(): THREE.Object3D { return this.env.skinModel(this.def.drop.skin as SkinId); }
  sig(): void { this.env.elites().signature(this.def.id); }
  hurt(a: Animal, dmg: number, throughWalls = false): void { this.env.hurt(a, dmg, throughWalls); }
}

// ─────────────────────────────── Old Ironhide ───────────────────────────────

class Ironhide extends PineElite {
  readonly lane: LaneCharge;
  again = false;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, PINE_LANES.ironhide, this.env.reach);
  }
  protected override clearTells(): void { this.lane.cancel(); }
  force(): void { const a = this.animal; if (a) { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); } }
  protected fight(a: Animal, dt: number, t: number): void { ironhideGoal(this, a, dt, t); }
}

// ─────────────────────────────── the Ghost Stag ───────────────────────────────

class GhostStag extends PineElite {
  cd = 3;
  lastHit = -Infinity;
  fadeT = 0;
  autoT = 5;
  protected override onSpawn(a: Animal): void { this.lastHit = a.lastHitT; this.cd = 3; }
  protected override clearTells(): void {
    const a = this.animal;
    if (a && this.mode === 'faded') this.reappear(a, a.position.x, a.position.z);
  }
  force(): void { const a = this.animal; if (a) this.fade(a); }
  protected fight(a: Animal, dt: number, t: number): void { ghostGoal(this, a, dt, t); }
  /** the fade: a pale burst, gone — no hitbox, no aim assist, no bar — for 2 s */
  fade(a: Animal): void {
    _v.copy(a.position); _v.y += 1.1 * a.scale;
    this.env.puffs.burst(_v, 0.6, 3.2, 0.7, 0.95);
    voice(this.env.animals, 'deer_call', a.position);
    a.hidden = true; a.mesh.visible = false; a.setMotion(a.yaw, 0, 1);
    this.fadeT = 2; this.cd = fadeCooldown(this.p2);
    this.setMode('faded'); this.sig();
  }
  /** back behind you, 14–18 m off, on dry walkable ground inside its leash */
  comeBack(a: Animal): void {
    const p = this.env.player.position, L = this.def.lair;
    for (const side of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const q = behindPlayer(p.x, p.z, this.env.player.yaw, 14 + this.next() * 4, side);
      if (!inChunk(q.x, q.z, 24) || Math.hypot(q.x - L.x, q.z - L.z) > this.def.leashR - 12) continue;
      if (Math.abs(heightAt(q.x, q.z) - heightAt(p.x, p.z)) > 6) continue;
      this.reappear(a, q.x, q.z); return;
    }
    this.reappear(a, a.position.x, a.position.z);
  }
  private reappear(a: Animal, x: number, z: number): void {
    const p = this.env.player.position;
    a.place(x, z, headingTo(x, z, p.x, p.z));
    a.hidden = false; a.mesh.visible = true;
    _v.copy(a.position); _v.y += 1.1 * a.scale;
    this.env.puffs.burst(_v, 2.8, 0.8, 0.5, 0.8);
    this.setMode('stare');
  }
}

// ─────────────────────────────── Old Blackpaw ───────────────────────────────

class Blackpaw extends PineElite {
  readonly ring: GroundTell;
  readonly lane: LaneCharge;
  roarCd = 0;
  swipeT = -1;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.ring = new GroundTell(env.game.scene, 'ring', TELL_RED);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, PINE_LANES.blackpaw, this.env.reach);
  }
  protected override onSpawn(a: Animal): void { this.lurk(a); }
  protected override clearTells(): void { this.ring.hide(); this.lane.cancel(); this.swipeT = -1; }
  get ringR(): number { return this.p2 ? 11 : 8; }
  /** in the cave: out of sight at the mouth */
  private lurk(a: Animal): void {
    a.place(MOUTH.x, MOUTH.z, BEAR_CAVE.rot + Math.PI);
    a.hidden = true; a.mesh.visible = false;
    this.setMode('lurk');
  }
  force(move: string): void {
    const a = this.animal; if (!a) return;
    if (a.hidden) this.burstOut(a);
    if (move === 'roar') this.setMode('roar'); else { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); }
  }
  protected override idle(a: Animal, dt: number): void {
    if (this.mode === 'lurk') return;
    // back from a fight: walk to the mouth, then in (only when you are not watching from close by)
    const d = Math.hypot(MOUTH.x - a.position.x, MOUTH.z - a.position.z);
    if (d > 2.5) { a.setMotion(headingTo(a.position.x, a.position.z, MOUTH.x, MOUTH.z), 2.2, 2); return; }
    if (a.position.distanceTo(this.env.player.position) > 35) this.lurk(a); else super.idle(a, dt);
  }
  burstOut(a: Animal): void {
    const p = this.env.player.position;
    a.place(MOUTH.x - Math.sin(BEAR_CAVE.rot) * 2.5, MOUTH.z - Math.cos(BEAR_CAVE.rot) * 2.5, headingTo(MOUTH.x, MOUTH.z, p.x, p.z));
    a.hidden = false; a.mesh.visible = true;
    _v.copy(a.position); _v.y += 0.4;
    Impacts.for(this.env.game).burst('dirt', _v, _v.set(p.x - a.position.x, 0, p.z - a.position.z), 18);
    this.sig();
  }
  roarFx(a: Animal): void { a.headWorld(_v); this.env.puffs.burst(_v, 1, this.ringR, 0.55, 0.5); }
  protected fight(a: Animal, dt: number, t: number): void { blackpawGoal(this, a, dt, t); }
}

// ─────────────────────────────── the Imperial Bull ───────────────────────────────

interface Rival { a: Animal; lane: LaneCharge; mode: 'approach' | 'charge' }

class ImperialBull extends PineElite {
  readonly lane: LaneCharge;
  private readonly rivalLanes: LaneCharge[];
  rivals: Rival[] = [];
  bugledPhase = -1;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, PINE_LANES.imperial, this.env.reach);
    this.rivalLanes = [0, 1].map(() => new LaneCharge(env.game.scene, TELL_RED, PINE_LANES.rival, this.env.reach));
  }
  protected override clearTells(): void { this.lane.cancel(); }
  override reset(): void { super.reset(); this.releaseRivals(); this.bugledPhase = -1; }
  override trophy(): void { super.trophy(); this.releaseRivals(); }
  override despawn(): void { this.releaseRivals(); super.despawn(); }
  private releaseRivals(): void { for (const r of this.rivals) { r.lane.cancel(); release(r.a); } this.rivals = []; }
  force(move: string): void {
    const a = this.animal; if (!a) return;
    if (move === 'bugle') this.setMode('bugle');
    else { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); }
  }
  callRivals(a: Animal): void {
    const p = this.env.player.position, { yaw } = this.toPlayer(a);
    for (const [i, side] of [1, -1].entries()) {
      const ang = yaw + side * Math.PI / 2;
      let x = p.x + Math.sin(ang) * 55, z = p.z + Math.cos(ang) * 55;
      if (!inChunk(x, z, 24)) { x = p.x - Math.sin(ang) * 40; z = p.z - Math.cos(ang) * 40; }
      const r = this.env.animals.spawn('elk', x, z, headingTo(x, z, p.x, p.z), i === 0 ? 'big-bull' : 'bull');
      own(r);
      const lane = this.rivalLanes[i];
      if (lane) this.rivals.push({ a: r, lane, mode: 'approach' });
      voice(this.env.animals, 'elk_bugle', r.position);
    }
  }
  tickRivals(dt: number, t: number): void {
    const p = this.env.player.position;
    for (const r of this.rivals) {
      if (!r.a.alive) { r.lane.cancel(); continue; }
      const d = Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z);
      r.a.lookTarget.copy(p); r.a.lookWeight = 1;
      if (r.mode === 'charge') { r.lane.update(r.a, dt, t, p, (dmg) => { this.hurt(r.a, dmg); this.env.trauma(0.35); }); if (!r.lane.busy) r.mode = 'approach'; continue; }
      r.a.setMotion(headingTo(r.a.position.x, r.a.position.z, p.x, p.z), d > 16 ? 7 : 1.5, 2.5);
      if (d < 20 && this.next() < dt * 0.6) { r.lane.start(r.a, p.x, p.z, 0.9); r.mode = 'charge'; }
    }
    this.rivals = this.rivals.filter((r) => r.a.alive || r.lane.busy);
  }
  protected fight(a: Animal, dt: number, t: number): void { imperialGoal(this, a, dt, t); }
}

// ─────────────────────────────── the wiring ───────────────────────────────

export interface PineElitesHandle {
  elites: Elites;
  update: (dt: number, t: number) => void;
  /** dev / captures: run an elite's signature move now ('charge' | 'fade' | 'roar' | 'bugle') */
  force: (id: string, move: string) => void;
}

type Forceable = PineElite & { force: (move: string) => void };

export function makePineElites(ctx: PineCtx, elites: Elites): PineElitesHandle {
  const env: Env = { ...ctx, elites: () => elites, puffs: new Puffs(ctx.game.scene, new THREE.Color(0.75, 1.6, 2.0)) };
  const scripts: Forceable[] = [];
  const add = (s: Forceable): void => {
    const scope = app.levelScope;
    if (scope !== null) app.encounters.elite(s.def.id, s, scope);
    elites.add(s); scripts.push(s);
  };
  const def = (id: string): EliteDef => { const d = PINE_ELITE_DEFS[id]; if (d === undefined) throw new Error(`no elite '${id}'`); return d; };
  add(new Ironhide(def('ironhide'), env));
  add(new GhostStag(def('ghost-stag'), env));
  add(new Blackpaw(def('blackpaw'), env));
  add(new ImperialBull(def('imperial-bull'), env));
  return {
    elites,
    update: (dt, t) => { elites.update(dt, t); env.puffs.update(dt, t); },
    force: (id, move) => { const s = scripts.find((x) => x.def.id === id); s?.force(move); },
  };
}
