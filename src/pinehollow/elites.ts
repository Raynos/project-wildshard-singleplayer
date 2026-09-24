import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import type { AnimalManager } from '../entities/AnimalManager';
import { GroundTell, type Elites, type EliteDef, type EliteScript } from '../game/Elite';
import { heightAt, inChunk } from '../world/Heightfield';
import { DEN, BEAR_CAVE } from '../chunks/pineHollowLayout';
import type { ItemId } from '../game/Inventory';
import type { SkinId } from '../player/Skins';
import { Impacts } from '../fx/Impacts';
import { Puffs } from './fxKit';
import { own, release, retire, voice, LaneCharge, type PineCtx } from './ctx';
import { behindPlayer, bugleHour, fadeCooldown, fleeHeading, headingTo, inArc } from './combatMath';

/**
 * Pine Hollow's four NAMED ELITES (PINE-HOLLOW-REMASTER PH-C3; Jake's PH-U13). Each is an `EliteScript` over the engine's
 * elite system (src/game/Elite.ts, ported from Nalati: lair + leash, the bar over the head → pinned, phase 2 at 50 %,
 * the banner, the minimap skull, the 20-minute respawn, the first-kill skin orb + a trophy every kill).
 *
 * IDENTITY: an elite is its species' legendary / rare variant placed at a lair — kind + variant, never a mesh — so it
 * wears whatever hull the creature lane gives that variant (PH-M1's generated coats), and the journal (compendium
 * shards/pine-hollow.ts `match`), the trophy wall and the achievements see the kill exactly as before. A herd that
 * rolled one of these variants at boot gets an ordinary one of its kind instead (`swapRolledElites`): there is one
 * Old Ironhide, and he lives at his lair.
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

// the lairs (x = WEST, z = NORTH: pineHollowLayout.ts's axis note). Chosen on open ground off the trails, one per zone.
export const IRONHIDE_LAIR = { x: -44, z: -76, r: 16 };
export const GHOST_LAIR = { x: 62, z: -100, r: 22 };   // > 110 m from the King's clearing: its bar must never ride into his fight
export const IMPERIAL_LAIR = { x: -40, z: 78, r: 20 };
export const BLACKPAW_LAIR = { x: DEN.x + 2, z: DEN.z + 2, r: 20 };
/** where Blackpaw waits: a step inside the cave mouth (the mouth faces SE: (−sin rot, −cos rot)) */
const MOUTH = { x: BEAR_CAVE.x - Math.sin(BEAR_CAVE.rot) * 1.5, z: BEAR_CAVE.z - Math.cos(BEAR_CAVE.rot) * 1.5 };

export const PINE_ELITE_DEFS: Record<string, EliteDef> = {
  ironhide: {
    id: 'ironhide', name: 'Old Ironhide', epithet: 'Terror of the Hollow', lair: IRONHIDE_LAIR,
    awareR: 55, engageR: 32, leashR: 85, rule: 'always', respawnMin: 20, signature: 'GORE CHARGE', phase2: 'BOTH TUSKS NOW',
    drop: { skin: 'ironhide', skinName: 'IRONHIDE', weapon: 'rifle', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge', trophyName: "Ironhide's broken tusk" },
  },
  'ghost-stag': {
    id: 'ghost-stag', name: 'The Ghost Stag', epithet: 'The Pale One', lair: GHOST_LAIR,
    awareR: 70, engageR: 40, leashR: 110, rule: 'always', respawnMin: 20, signature: 'FADE', phase2: "NOW YOU DON'T",
    drop: { skin: 'ghost-stag', skinName: 'GHOST STAG', weapon: 'crossbow', blurb: "bone-white ash, the stag's own antlers for a prod", trophyName: 'A pale antler that weighs nothing' },
  },
  blackpaw: {
    id: 'blackpaw', name: 'Old Blackpaw', epithet: "The Den's Landlord", lair: BLACKPAW_LAIR,
    awareR: 30, engageR: 22, leashR: 60, rule: 'always', respawnMin: 20, signature: 'ROAR', phase2: 'WOKEN UP PROPERLY',
    drop: { skin: 'blackpaw', skinName: 'BLACKPAW', weapon: 'crossbow', blurb: 'bear-black stock, claw-hook nocks, the rent in arrears', trophyName: "Old Blackpaw's claw" },
  },
  'imperial-bull': {
    id: 'imperial-bull', name: 'The Imperial Bull', epithet: 'Seven by Seven', lair: IMPERIAL_LAIR,
    awareR: 75, engageR: 45, leashR: 110, rule: 'always', respawnMin: 20, signature: 'BUGLE', phase2: 'FULL VOLUME',
    drop: { skin: 'imperial', skinName: 'IMPERIAL', weapon: 'crossbow', blurb: 'antler-ivory stock, gold fittings, seven tines on the prod', trophyName: 'The seven-tine crown' },
  },
};

/** each elite's species variant (its identity) and its trophy */
export const PINE_ELITE_ANIMALS: Record<string, { kind: string; variant: string; trophy: ItemId }> = {
  ironhide: { kind: 'boar', variant: 'ironhide', trophy: 'ironhide-tusk' },
  'ghost-stag': { kind: 'deer', variant: 'ghost', trophy: 'ghost-antler' },
  blackpaw: { kind: 'bear', variant: 'black-old', trophy: 'blackpaw-claw' },
  'imperial-bull': { kind: 'elk', variant: 'imperial', trophy: 'imperial-crown' },
};

/** an ordinary variant of the same kind, for a herd animal that rolled an elite's variant at boot */
const ORDINARY: Record<string, string[]> = { boar: ['boar', 'sow', 'black'], deer: ['hind', 'stag'], bear: ['black', 'black-blaze'], elk: ['cow', 'bull'] };

/** every herd animal that rolled an elite's variant is replaced by an ordinary one of its kind, in its herd, where it stood */
export function swapRolledElites(animals: AnimalManager): number {
  let n = 0;
  const rolled = animals.animals.filter((a) => Object.values(PINE_ELITE_ANIMALS).some((e) => e.kind === a.kind && e.variant === a.variant));
  for (const a of rolled) {
    const herd = a.herd, x = a.position.x, z = a.position.z, yaw = a.yaw;
    retire(animals, a);
    const b = animals.spawn(a.kind, x, z, yaw, ORDINARY[a.kind] ?? []);
    b.herd = herd;
    const h = herd >= 0 ? animals.herds[herd] : undefined;
    if (h) { const i = h.members.indexOf(a); if (i !== -1) h.members[i] = b; else h.members.push(b); }
    n++;
  }
  return n;
}

const elitesOwned = new WeakSet<Animal>();
/** one of the named elites (main.ts: its legendary skin comes from the elite's orb, not the kill hook) */
export function isPineElite(a: Animal): boolean { return elitesOwned.has(a); }

interface Env extends PineCtx { elites: () => Elites; puffs: Puffs }

const _v = new THREE.Vector3();

abstract class PineElite implements EliteScript {
  animal: Animal | null = null;
  protected p2 = false;
  protected mode = 'idle';
  protected modeT = 0;
  protected wx = 0; protected wz = 0; protected wanderT = 0;
  protected readonly who: { kind: string; variant: string; trophy: ItemId };
  constructor(readonly def: EliteDef, protected readonly env: Env) {
    const who = PINE_ELITE_ANIMALS[def.id];
    if (who === undefined) throw new Error(`pine elite '${def.id}' has no animal`);
    this.who = who;
  }
  spawn(): void {
    const L = this.def.lair;
    const a = this.env.animals.spawn(this.who.kind, L.x, L.z, Math.random() * Math.PI * 2, this.who.variant);
    own(a); elitesOwned.add(a);
    this.animal = a; this.p2 = false; this.setMode('idle'); this.wx = L.x; this.wz = L.z; this.wanderT = 0;
    this.onSpawn(a);
  }
  protected onSpawn(_a: Animal): void { /* per elite */ }
  despawn(): void { this.clearTells(); if (this.animal) retire(this.env.animals, this.animal); this.animal = null; }
  reset(): void { this.p2 = false; this.clearTells(); this.setMode('home'); }
  enterPhase2(): void { this.p2 = true; }
  trophy(): void { this.clearTells(); this.env.addItem(this.who.trophy); this.env.feed(`${this.def.drop.trophyName} — ${this.def.name}`); }
  dropModel(): THREE.Object3D { return this.env.skinModel(this.def.drop.skin as SkinId); }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a?.alive) { this.clearTells(); return; }
    this.modeT += dt;
    if (leashing) { this.clearTells(); this.goHome(a); return; }
    if (engaged) this.fight(a, dt, t); else this.idle(a, dt);
  }
  protected abstract fight(a: Animal, dt: number, t: number): void;
  protected clearTells(): void { /* per elite */ }
  protected setMode(m: string): void { this.mode = m; this.modeT = 0; }
  protected sig(): void { this.env.elites().signature(this.def.id); }
  protected toPlayer(a: Animal): { d: number; yaw: number } {
    const p = this.env.player.position;
    return { d: Math.hypot(p.x - a.position.x, p.z - a.position.z), yaw: headingTo(a.position.x, a.position.z, p.x, p.z) };
  }
  protected hurt(a: Animal, dmg: number): void { this.env.hurt(a, dmg); }
  /** unengaged: stroll between spots in the lair, glance at a player who is near */
  protected idle(a: Animal, dt: number): void {
    const L = this.def.lair;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 7 + Math.random() * 8;
      const ang = Math.random() * Math.PI * 2, r = Math.random() * L.r * 0.6;
      this.wx = L.x + Math.cos(ang) * r; this.wz = L.z + Math.sin(ang) * r;
    }
    const d = Math.hypot(this.wx - a.position.x, this.wz - a.position.z);
    a.setMotion(headingTo(a.position.x, a.position.z, this.wx, this.wz), d > 1.5 && this.wanderT < 5 ? 1.1 : 0, 1.5);
    const p = this.env.player.position;
    a.lookTarget.copy(p); a.lookWeight = a.position.distanceTo(p) < this.def.awareR ? 0.8 : 0;
  }
  protected goHome(a: Animal): void {
    const L = this.def.lair, d = Math.hypot(L.x - a.position.x, L.z - a.position.z);
    a.setMotion(headingTo(a.position.x, a.position.z, L.x, L.z), d > 3 ? 4 : 0, 2.5);
    a.lookWeight = 0;
  }
}

// ─────────────────────────────── Old Ironhide ───────────────────────────────

class Ironhide extends PineElite {
  private readonly lane: LaneCharge;
  private again = false;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, { width: 2.4, speed: 12.5, overshoot: 7, dmg: 30, skid: 1.1, reach: 1.7 });
  }
  protected override clearTells(): void { this.lane.cancel(); }
  force(): void { const a = this.animal; if (a) { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); } }
  protected fight(a: Animal, dt: number, t: number): void {
    const p = this.env.player.position, { d, yaw } = this.toPlayer(a);
    a.lookTarget.copy(p); a.lookWeight = 1;
    if (this.mode === 'charge') {
      this.lane.update(a, dt, t, p, (dmg) => { this.hurt(a, dmg); this.env.trauma(0.45); });
      if (this.lane.state === 'run' && this.lane.t < dt * 1.5) voice(this.env.animals, 'boar_squeal', a.position);
      if (!this.lane.busy) {
        if (this.again) { this.again = false; this.lane.start(a, p.x, p.z, 0.55, 1.1); return; }
        this.setMode('circle');
      }
      return;
    }
    // circle: trot round you at ~13 m (the tangent, bent in or out to hold the radius), then charge
    const want = 13, side = Math.sin(a.seed * 31) > 0 ? 1 : -1;
    const tangent = yaw + side * Math.PI / 2, bend = THREE.MathUtils.clamp((d - want) / 8, -1, 1) * 0.9 * side;
    a.setMotion(tangent - bend, 4.2, 2.8);
    if (this.mode === 'idle' || this.mode === 'home') this.setMode('circle');
    if (this.modeT > (this.p2 ? 1.4 : 2.6) && d < 30) {
      this.lane.start(a, p.x, p.z, this.p2 ? 0.62 : 0.9, this.p2 ? 1.12 : 1);
      this.again = this.p2 && Math.random() < 0.55;
      voice(this.env.animals, 'boar_grunt', a.position);
      this.setMode('charge'); this.sig();
    }
  }
}

// ─────────────────────────────── the Ghost Stag ───────────────────────────────

class GhostStag extends PineElite {
  private cd = 3;
  private lastHit = -Infinity;
  private fadeT = 0;
  private autoT = 5;
  protected override onSpawn(a: Animal): void { this.lastHit = a.lastHitT; this.cd = 3; }
  protected override clearTells(): void {
    const a = this.animal;
    if (a && this.mode === 'faded') this.reappear(a, a.position.x, a.position.z);
  }
  force(): void { const a = this.animal; if (a) this.fade(a); }
  protected fight(a: Animal, dt: number, t: number): void {
    void t;
    const p = this.env.player.position, { d, yaw } = this.toPlayer(a);
    this.cd -= dt;
    const hit = a.lastHitT > this.lastHit; if (hit) this.lastHit = a.lastHitT;
    if (this.mode === 'faded') {
      this.fadeT -= dt;
      if (this.fadeT <= 0) this.comeBack(a);
      return;
    }
    if (this.cd <= 0 && (hit || d < 12)) { this.fade(a); return; }
    if (this.p2 && this.mode === 'flee') { this.autoT -= dt; if (this.autoT <= 0 && this.cd <= 0) { this.autoT = 3.5 + Math.random() * 1.5; this.fade(a); return; } }
    if (this.mode === 'stare') {
      a.setMotion(yaw, 0, 4); a.lookTarget.copy(p); a.lookWeight = 1;
      if (this.modeT > (this.p2 ? 1.1 : 1.6) || hit) this.setMode('flee');
      return;
    }
    if (this.mode !== 'flee') this.setMode('flee');
    const L = this.def.lair;
    a.setMotion(fleeHeading(a.position.x, a.position.z, p.x, p.z, L.x, L.z, this.def.leashR * 0.55), 7, 3.2);
    a.lookWeight = 0;
    if (this.modeT > 2.6 + (a.seed % 1) * 1.4) this.setMode('stare');
  }
  /** the fade: a pale burst, gone — no hitbox, no aim assist, no bar — for 2 s */
  private fade(a: Animal): void {
    _v.copy(a.position); _v.y += 1.1 * a.scale;
    this.env.puffs.burst(_v, 0.6, 3.2, 0.7, 0.95);
    voice(this.env.animals, 'deer_call', a.position);
    a.hidden = true; a.mesh.visible = false; a.setMotion(a.yaw, 0, 1);
    this.fadeT = 2; this.cd = fadeCooldown(this.p2);
    this.setMode('faded'); this.sig();
  }
  /** back behind you, 14–18 m off, on dry walkable ground inside its leash */
  private comeBack(a: Animal): void {
    const p = this.env.player.position, L = this.def.lair;
    for (const side of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const q = behindPlayer(p.x, p.z, this.env.player.yaw, 14 + Math.random() * 4, side);
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
  private readonly ring: GroundTell;
  private readonly lane: LaneCharge;
  private roarCd = 0;
  private swipeT = -1;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.ring = new GroundTell(env.game.scene, 'ring', TELL_RED);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, { width: 2.6, speed: 10.5, overshoot: 5, dmg: 28, skid: 1.2, reach: 1.6 });
  }
  protected override onSpawn(a: Animal): void { this.lurk(a); }
  protected override clearTells(): void { this.ring.hide(); this.lane.cancel(); this.swipeT = -1; }
  private get ringR(): number { return this.p2 ? 11 : 8; }
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
  private burstOut(a: Animal): void {
    const p = this.env.player.position;
    a.place(MOUTH.x - Math.sin(BEAR_CAVE.rot) * 2.5, MOUTH.z - Math.cos(BEAR_CAVE.rot) * 2.5, headingTo(MOUTH.x, MOUTH.z, p.x, p.z));
    a.hidden = false; a.mesh.visible = true;
    _v.copy(a.position); _v.y += 0.4;
    Impacts.for(this.env.game).burst('dirt', _v, _v.set(p.x - a.position.x, 0, p.z - a.position.z), 18);
    this.sig();
  }
  protected fight(a: Animal, dt: number, t: number): void {
    const p = this.env.player.position, { d, yaw } = this.toPlayer(a);
    this.roarCd -= dt;
    this.ring.setTime(t);
    a.lookTarget.copy(p); a.lookWeight = 1;
    if (this.mode === 'lurk') { this.burstOut(a); this.setMode('roar'); a.startAttack(1.1); voice(this.env.animals, 'bear_growl', a.position); return; }
    if (this.mode === 'roar') {
      // the tell: the ring round him swells and pulses; the roar roots anyone still in it
      a.setMotion(yaw, 0, 3);
      const k = Math.min(1, this.modeT / 1.1);
      this.ring.ring(a.position.x, a.position.z, this.ringR * (0.7 + 0.3 * k), 0.35 + 0.6 * k * (0.7 + 0.3 * Math.sin(t * 20)));
      if (this.modeT >= 1.1) {
        this.ring.hide();
        voice(this.env.animals, 'bear_roar', a.position);
        a.headWorld(_v);
        this.env.puffs.burst(_v, 1, this.ringR, 0.55, 0.5);
        this.env.trauma(0.3);
        if (d <= this.ringR && !this.env.god) { this.env.stun(1.3); this.hurt(a, 12); this.env.trauma(0.4); }
        this.roarCd = this.p2 ? 5.5 : 10;
        if (d > 5) { this.lane.start(a, p.x, p.z, this.p2 ? 0.6 : 0.75, this.p2 ? 1.12 : 1); this.setMode('charge'); } else this.setMode('stalk');
      }
      return;
    }
    if (this.mode === 'charge') {
      this.lane.update(a, dt, t, p, (dmg) => { this.hurt(a, dmg); this.env.trauma(0.5); });
      if (!this.lane.busy) this.setMode('stalk');
      return;
    }
    if (this.mode === 'swipe') {
      a.setMotion(yaw, 0, 2.5);
      if (this.swipeT >= 0) { this.swipeT -= dt; if (this.swipeT < 0) { voice(this.env.animals, 'bear_growl', a.position); if (inArc(a.position.x, a.position.z, a.yaw, p.x, p.z, 1.1, 3.8 * a.scale / 1.65)) { this.hurt(a, 22); this.env.trauma(0.35); } } }
      if (this.modeT > 1.2) this.setMode('stalk');
      return;
    }
    // stalk: walk you down, then pick a move
    if (this.mode !== 'stalk') this.setMode('stalk');
    a.setMotion(yaw, d > 3 ? (this.p2 ? 4 : 3.2) : 0, 2.2);
    if (this.roarCd <= 0 && d < 12) { this.setMode('roar'); a.startAttack(1.1); voice(this.env.animals, 'bear_growl', a.position); }
    else if (d < 3.6) { this.setMode('swipe'); this.swipeT = 0.55; a.startAttack(0.55); }
    else if (d > 7 && d < 22 && this.modeT > 2.2) { this.lane.start(a, p.x, p.z, this.p2 ? 0.6 : 0.75, this.p2 ? 1.12 : 1); this.setMode('charge'); }
  }
}

// ─────────────────────────────── the Imperial Bull ───────────────────────────────

interface Rival { a: Animal; lane: LaneCharge; mode: 'approach' | 'charge' }

class ImperialBull extends PineElite {
  private readonly lane: LaneCharge;
  private readonly rivalLanes: LaneCharge[];
  private rivals: Rival[] = [];
  private bugledPhase = -1;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    this.lane = new LaneCharge(env.game.scene, TELL_RED, { width: 2.8, speed: 11, overshoot: 8, dmg: 34, skid: 1.3, reach: 1.8 });
    this.rivalLanes = [0, 1].map(() => new LaneCharge(env.game.scene, TELL_RED, { width: 2.4, speed: 9.5, overshoot: 6, dmg: 18, skid: 1.4, reach: 1.7 }));
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
  private callRivals(a: Animal): void {
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
  private tickRivals(dt: number, t: number): void {
    const p = this.env.player.position;
    for (const r of this.rivals) {
      if (!r.a.alive) { r.lane.cancel(); continue; }
      const d = Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z);
      r.a.lookTarget.copy(p); r.a.lookWeight = 1;
      if (r.mode === 'charge') { r.lane.update(r.a, dt, t, p, (dmg) => { this.hurt(r.a, dmg); this.env.trauma(0.35); }); if (!r.lane.busy) r.mode = 'approach'; continue; }
      r.a.setMotion(headingTo(r.a.position.x, r.a.position.z, p.x, p.z), d > 16 ? 7 : 1.5, 2.5);
      if (d < 20 && Math.random() < dt * 0.6) { r.lane.start(r.a, p.x, p.z, 0.9); r.mode = 'charge'; }
    }
    this.rivals = this.rivals.filter((r) => r.a.alive || r.lane.busy);
  }
  protected fight(a: Animal, dt: number, t: number): void {
    const p = this.env.player.position, { d, yaw } = this.toPlayer(a);
    this.tickRivals(dt, t);
    a.lookTarget.copy(p); a.lookWeight = 1;
    const phase = this.p2 ? 1 : 0;
    if (this.mode === 'bugle') {
      // head up, the long call; the rivals answer out of the trees
      a.setMotion(yaw, 0, 2); a.lookTarget.y += 12;
      if (this.modeT > 0.2 && this.modeT - dt <= 0.2) voice(this.env.animals, 'elk_bugle', a.position);
      if (this.modeT >= 1.8) { this.callRivals(a); this.setMode('posture'); }
      return;
    }
    if (this.mode === 'charge') {
      this.lane.update(a, dt, t, p, (dmg) => { this.hurt(a, dmg); this.env.trauma(0.5); });
      if (!this.lane.busy) this.setMode('posture');
      return;
    }
    if (this.mode !== 'posture') this.setMode('posture');
    if (this.bugledPhase < phase && this.rivals.length === 0 && bugleHour(this.env.dusk(), this.env.night())) {
      this.bugledPhase = phase; this.setMode('bugle'); this.sig(); return;
    }
    // posture: hold 18–26 m off, side-on steps, facing you
    const back = d < 18 ? -1 : d > 26 ? 1 : 0;
    const side = Math.sin(t * 0.7 + a.seed * 9) > 0 ? 1 : -1;
    a.setMotion(back === 0 ? yaw + side * 1.2 : back > 0 ? yaw : yaw + Math.PI, back === 0 ? 1.2 : 3.5, 2.2);
    if (this.modeT > (this.p2 ? 2 : 3.2)) { this.lane.start(a, p.x, p.z, this.p2 ? 0.75 : 1.0, this.p2 ? 1.12 : 1); voice(this.env.animals, 'deer_call', a.position); this.setMode('charge'); }
  }
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
  const add = (s: Forceable): void => { elites.add(s); scripts.push(s); };
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
