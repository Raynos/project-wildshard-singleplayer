import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { AnimalManager } from '../entities/AnimalManager';
import type { Animal } from '../entities/Animal';
import { registerSpecies, speciesDef, hasSpecies, type ThinkCtx } from '../entities/species/registry';
import type { Wildlife } from '../entities/Wildlife';
import type { Pack } from '../entities/Pack';
import type { HorseHerd } from '../entities/Herd';
import type { Interactable } from '../world/Cabin';
import type { Ledge } from '../world/nalati/Crags';
import type { ItemId } from '../game/Inventory';
import { heightAt } from '../world/Heightfield';
import { wildEnv } from '../entities/wildEnv';
import { setEliteBrain, setEliteDamage, eliteThink, eliteDamageMul } from '../entities/eliteBrain';
import { horseSaddle } from '../entities/species/horse';
import { LEOPARD } from '../entities/species/leopard';
import { EAGLE } from '../entities/species/eagle';
import { KOKBORI } from '../entities/species/kokbori';
import { Elites, GroundTell, type EliteDef, type EliteScript, type EliteRule } from '../game/Elite';
import { EliteBar } from '../ui/EliteBar';
import { painterlyMaterial } from '../world/painterly';
import { fxMaterial, FX, type FxMaterial } from '../world/nalati/KurganDungeon';
import { PaintKit, M, pole, v3, blob } from '../world/nalati/paint';
import { EAGLE_ROCK, CRAG_CAVE } from '../world/nalati/layout';

/**
 * Nalati's five NAMED ELITES (plan NALATI.md row B12; design docs/design/nalati/elites-and-bosses.md §1 "The five Nalati
 * elites"; mockups art/nalati-grasslands/round-2/4-named-elites/, round-3/1-elite-swap/elite-stallion-argymaq…). Each is
 * an `EliteScript` over the engine's elite system (src/game/Elite.ts: spawn rule, aware / engaged / leash, the bar over
 * the head → pinned, phase 2 at 50 %, the banner, the drop, the 20-minute timer, the minimap skull):
 *
 *   AQBARS the Pale (snow leopard, the Crags, always) — stalks along the Crags' ledges (`pois.cragLedges`) above you.
 *     POUNCE: from a ledge 3–8 m up (or a run-up on open ground) a red-gold ring paints at your feet (1.0 s) → it leaps:
 *     35 + a knock-down if you are still in the ring, else it skids, OPEN 1.5 s (headshots ×3). Swipes 2 × 14. Airborne
 *     ×2. Phase 2: hit-and-run from a ledge — up there it takes a quarter.
 *   KOKBORI, Mother of the Pack (the giant she-wolf, dusk + night, the tall-grass basin W of the horse plains) — with a
 *     pack of five (B4's Pack AI), at ×2.6. She holds 24–32 m back and moves when you look at her. PACK HOWL: pale rings ripple
 *     out (1.2 s) → the pack converges and encircles; hit her mid-howl and it breaks: she staggers, the pack scatters.
 *     Phase 2: the pack falls back round her and she comes for you herself (lunges, 22). From HIDDEN (crouched in tall
 *     grass) arrows do ×2.
 *   QYRAN the Storm-Wing (the giant golden eagle, ONLY in a storm, Eagle Rock) — circles 24 m over you (36 in phase 2; over the rock when idle), drifting downwind, at ×3.
 *     STOOP: a gold line streaks from it to you and a gold chevron glows at the screen edge (1.2 s) → a 40 m/s dive: 30 +
 *     knock-down, or it hits the ground and is GROUNDED 2 s (every hit ×2.5). Phase 2: higher, in the cloud, faster stoops.
 *   QARA BATYR the Unburied (the ghost-rider captain, NIGHT, the rim's burial cairn) — a spectral rider on a spectral
 *     horse (the creature row's horse rig in a ghost material + a rider). Circles you at the gallop. DEATH CHARGE: a
 *     lane of cyan ghost-fire burns toward you (1.3 s) → 38 + knock-down; swerve and his back is OPEN 2 s (a blade ×3).
 *     Phase 2: the charges come in pairs. He rides B11's captain rig (src/nalati/ghostRiders.ts, handed in by index.ts) with a
 *     line of three of its riders; without B11 wired, a fallback rig of our own.
 *   ARGYMAQ the Unbroken (the feral black stallion, the Crags' high pasture, always, ONCE) — the stallion of his own herd
 *     (B4's HorseHerd: the herd AI rears and charges; this script paints the TRAMPLE lane when he rears and leads the
 *     herd away in phase 2). Beaten under 25 % he is BROKEN, not killed — the taming row's flow takes over (MOUNT →
 *     bucking → bonded); tamed, he is your horse (the bonded Tulpar grows to his ×1.3) and his lair retires for good.
 *
 * Drops are cosmetic (the skins are owned here, WORN by B15): IRBIS sabre · SKY-WOLF bow · STORM-WING arrows · NIGHT RIDER
 * mount. Trophies go to the pack (Inventory). Achievements + joke titles are src/game/achievements.ts's NALATI table.
 *
 *   const elites = wireElites({ game, sky, player, ledges, cave, clock, storm });     // boot (src/nalati/index.ts)
 *   elites.bind(play)                                                                   // main.ts, once animals / HUD exist
 *   elites.update(dt, t)                                                                // every frame
 *   Dev: `?elite=aqbars|kokbori|qyran|qara-batyr|argymaq` spawns it (whatever its rule) and puts you 30–45 m from it (`&from=<m>` to stand farther, `&here=x,z` to move its lair);
 *   `window.__elites`.
 */

// ─────────────────────────────── the defs ───────────────────────────────

/** the tall-grass basin west (+x) of the horse plains: Kokbori's den on a rocky rise */
const KOKBORI_DEN = { x: 186, z: -96 };
/** the burial cairn on the rim ridge: Qara Batyr's lair */
const QARA_CAIRN = { x: -62, z: -46 };
/** the Crags' western shoulder, the high pasture (+45…+55 m): Argymaq's herd */
const ARGYMAQ_PASTURE = { x: -128, z: -206 };

export const ELITE_DEFS: Record<string, EliteDef> = {
  aqbars: {
    id: 'aqbars', name: 'Aqbars the Pale', epithet: 'Irbis of the Crags', lair: { x: CRAG_CAVE.x, z: CRAG_CAVE.z, r: 14 },
    awareR: 60, engageR: 25, leashR: 90, rule: 'always', respawnMin: 20, signature: 'POUNCE', phase2: 'ENRAGED',
    drop: { skin: 'irbis-sabre', skinName: 'IRBIS', weapon: 'sabre', blurb: 'pale frost steel, rosette damascus, a snow-leopard grip', trophyName: 'Snow-leopard pelt' },
  },
  kokbori: {
    id: 'kokbori', name: 'Kokbori', epithet: 'Mother of the Pack', lair: { x: KOKBORI_DEN.x, z: KOKBORI_DEN.z, r: 16 },
    awareR: 80, engageR: 50, leashR: 120, rule: 'dusk', respawnMin: 20, signature: 'PACK HOWL', phase2: 'THE PACK FALLS BACK',
    drop: { skin: 'sky-wolf-bow', skinName: 'SKY-WOLF', weapon: 'bow', blurb: 'blue-grey horn limbs, wolf-fang nocks, a silver string', trophyName: "The grey mother's pelt" },
  },
  qyran: {
    id: 'qyran', name: 'Qyran the Storm-Wing', epithet: 'Berkut of the High Wind', lair: { x: EAGLE_ROCK.x, z: EAGLE_ROCK.z, r: 20 },
    awareR: 110, engageR: 75, leashR: 150, rule: 'storm', respawnMin: 20, signature: 'STOOP', phase2: 'INTO THE STORM',
    drop: { skin: 'storm-wing-arrows', skinName: 'STORM-WING', weapon: 'arrow', blurb: 'golden fletching, a gold streak behind every arrow', trophyName: 'Golden eagle feather' },
  },
  'qara-batyr': {
    id: 'qara-batyr', name: 'Qara Batyr the Unburied', epithet: 'Captain of the Night Riders', lair: { x: QARA_CAIRN.x, z: QARA_CAIRN.z, r: 18 },
    awareR: 90, engageR: 60, leashR: 150, rule: 'night', respawnMin: 20, signature: 'DEATH CHARGE', phase2: 'THE DEAD RIDE',
    drop: { skin: 'night-rider-mount', skinName: 'NIGHT RIDER', weapon: 'mount', blurb: 'black barding, a spectral mane that glows at night', trophyName: "The captain's standard" },
  },
  argymaq: {
    id: 'argymaq', name: 'Argymaq the Unbroken', epithet: 'Stallion of the High Crags', lair: { x: ARGYMAQ_PASTURE.x, z: ARGYMAQ_PASTURE.z, r: 22 },
    awareR: 80, engageR: 40, leashR: 100, rule: 'always', respawnMin: 20, once: true, signature: 'TRAMPLE', phase2: 'HE RUNS',
    drop: { skin: 'argymaq', skinName: 'ARGYMAQ', weapon: 'horse', blurb: 'the best horse in Nalati', trophyName: 'Black mane braid' },
  },
};

const TROPHY: Record<string, ItemId> = {
  aqbars: 'leopard-pelt', kokbori: 'grey-mother-pelt', qyran: 'eagle-feather', 'qara-batyr': 'captain-standard', argymaq: 'mane-braid',
};

/** the elites' voices (src/audio/Audio.ts animal sounds) */
export type EliteSound = 'wolf_howl' | 'bear_growl' | 'bear_roar' | 'horse_squeal' | 'monkey_shriek';

// ─────────────────────────────── the environment the scripts share ───────────────────────────────

interface Env {
  game: Game; sky: Sky; player: Player; animals: AnimalManager;
  elites: Elites; bar: EliteBar;
  wildlife: Wildlife | null;
  taming: { phase: string; tulpar: Animal | null } | null;
  ghosts: GhostsApi | null;
  ledges: Ledge[];
  hurt: (a: Animal, dmg: number) => void;
  knock: (dx: number, dz: number) => void;
  feed: (text: string) => void;
  addItem: (id: ItemId) => void;
  record: (kind: string, variant: string) => void;
  sound: (name: EliteSound, at: THREE.Vector3) => void;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/** out of the world for good: hidden, out of the manager's list (minimap, prompts, aim assist) */
function retire(animals: AnimalManager, a: Animal): void {
  a.hidden = true; a.mesh.visible = false; a.alive = false; a.position.y = -9999;
  const i = animals.animals.indexOf(a); if (i !== -1) animals.animals.splice(i, 1);
  a.mesh.removeFromParent();
}

function isHead(a: Animal, p: THREE.Vector3, slack = 0.12): boolean { a.headWorld(_h); return _h.distanceTo(p) < a.dims.headRadius * a.scale + slack; }

abstract class Base implements EliteScript {
  animal: Animal | null = null;
  protected p2 = false;
  protected t = 0;
  constructor(readonly def: EliteDef, protected readonly env: Env) {}
  abstract spawn(): void;
  abstract tick(dt: number, t: number, engaged: boolean, leashing: boolean): void;
  despawn(): void { if (this.animal) retire(this.env.animals, this.animal); this.animal = null; }
  reset(): void { this.p2 = false; }
  enterPhase2(): void { this.p2 = true; }
  trophy(): void { const id = TROPHY[this.def.id]; if (id !== undefined) this.env.addItem(id); this.env.feed(`${this.def.drop.trophyName} — ${this.def.name}`); }
  dropModel(): THREE.Object3D { return trophyModel(this.def.id, this.env.sky); }
  protected sig(): void { this.env.elites.signature(this.def.id); }
  protected spawnAt(kind: string, variant: string, x: number, z: number, yaw: number): Animal {
    const a = this.env.animals.spawn(kind, x, z, yaw, variant);
    a.herd = -1;
    this.animal = a;
    setEliteBrain(a, (an, c) => { this.think(an, c); });
    setEliteDamage(a, (an, p, d) => this.damage(an, p, d));
    return a;
  }
  /** the 10 Hz brain (the species' think forwards here) */
  protected think(_a: Animal, _c: ThinkCtx): void { /* per elite */ }
  protected damage(_a: Animal, _p: THREE.Vector3, _d: THREE.Vector3): number { return 1; }
  protected toPlayer(a: Animal): { d: number; yaw: number } {
    const p = this.env.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z;
    return { d: Math.hypot(dx, dz), yaw: Math.atan2(dx, dz) };
  }
  protected goHome(a: Animal, speed: number): void {
    const dx = this.def.lair.x - a.position.x, dz = this.def.lair.z - a.position.z;
    a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) > 3 ? speed : 0, 3);
  }
  protected melee(p: THREE.Vector3): boolean { const pl = this.env.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < 3.8; }
}

// ─────────────────────────────── E1 · Aqbars the Pale ───────────────────────────────

type AqSt = 'lurk' | 'stalk' | 'tell' | 'leap' | 'open' | 'swipe' | 'perch' | 'home';
class Aqbars extends Base {
  private st: AqSt = 'lurk';
  private stT = 0; private cd = 2;
  private ring: GroundTell;
  private from = new THREE.Vector3(); private to = new THREE.Vector3();
  private goal: { x: number; z: number; y: number } | null = null;
  private hitDone = 0;
  constructor(def: EliteDef, env: Env) { super(def, env); this.ring = new GroundTell(env.game.scene, 'ring', new THREE.Color(2.4, 0.9, 0.35)); }
  /** the ground or the ledge top under (x, z) */
  private standY(x: number, z: number): number {
    let y = heightAt(x, z);
    for (const l of this.env.ledges) if (Math.hypot(x - l.x, z - l.z) < l.r + 0.3) y = Math.max(y, l.y);
    return y;
  }
  override spawn(): void {
    const c = this.def.lair;
    const a = this.spawnAt(LEOPARD, 'aqbars', c.x, c.z, 0);
    a.mem['low'] = 0.3;
    this.st = 'lurk'; this.cd = 2;
  }
  override reset(): void { super.reset(); this.st = 'home'; this.ring.hide(); if (this.animal) { this.animal.mem['leap'] = 0; this.animal.mem['low'] = 0; } }
  override despawn(): void { this.ring.hide(); super.despawn(); }
  protected override damage(a: Animal, p: THREE.Vector3): number {
    if (this.st === 'leap') return 2;                                   // the weak point: its airborne body
    if (this.st === 'open') return isHead(a, p) ? 1.2 : 1;            // the skid: headshots ×3 (the manager's ×2.5 × 1.2)
    if (this.p2 && this.st === 'perch') return 0.25;                   // up on its ledge in phase 2
    return 1;
  }
  /** a pounce perch: a ledge 3–8 m above the player, 4–14 m from them */
  private perchFor(px: number, pz: number, py: number): Ledge | null {
    let best: Ledge | null = null, bd = Infinity;
    for (const l of this.env.ledges) {
      const up = l.y - py, d = Math.hypot(l.x - px, l.z - pz);
      if (up < 3 || up > 8 || d < 4 || d > 14) continue;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  protected override think(a: Animal, c: ThinkCtx): void {
    const pl = c.player, tp = this.toPlayer(a);
    this.cd -= c.dt;
    a.lookTarget.copy(pl); a.lookWeight = this.st === 'lurk' ? 0.4 : 1;
    switch (this.st) {
      case 'lurk': a.setMotion(a.yaw, 0, 1); break;
      case 'home': this.goHome(a, 5); if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 3) this.st = 'lurk'; break;
      case 'stalk': case 'perch': {
        a.mem['low'] = this.st === 'stalk' ? 0.8 : 0.2;
        if (tp.d < 2.4 && this.cd <= 0) { this.st = 'swipe'; this.hitDone = 0; a.startAttack(1.0); a.setMotion(tp.yaw, 0, 6); break; }
        const perch = this.perchFor(pl.x, pl.z, pl.y);
        if (perch !== null && this.cd <= 0) {
          const dp = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
          if (dp < 1.4) { this.startTell(a, pl); break; }
          a.setMotion(Math.atan2(perch.x - a.position.x, perch.z - a.position.z), 5.5, 4);
        } else if (tp.d > 7 && tp.d < 12 && this.cd <= 0) this.startTell(a, pl);   // no ledge: a run-up pounce on open ground
        else a.setMotion(tp.yaw, tp.d > 9 ? 4.2 : tp.d < 6 ? -1 : 0, 3);
        break;
      }
      case 'tell': a.setMotion(Math.atan2(this.to.x - a.position.x, this.to.z - a.position.z), 0, 6); break;
      case 'leap': case 'open': a.setMotion(a.yaw, 0, 2); break;
      case 'swipe': {
        a.setMotion(tp.yaw, 0, 5);
        const k = a.attackPhase;
        if (k >= 0.45 && this.hitDone === 0) { this.hitDone = 1; if (tp.d < 2.9) this.env.hurt(a, 14); }
        if (k >= 0.8 && this.hitDone === 1) { this.hitDone = 2; if (tp.d < 2.9) this.env.hurt(a, 14); }
        if (k >= 1 || k < 0) { a.cancelAttack(); this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 1.4; if (this.p2) this.retreat(a); }
        break;
      }
      default: break;
    }
  }
  private startTell(a: Animal, pl: THREE.Vector3): void {
    this.st = 'tell'; this.stT = 0;
    this.from.copy(a.position);
    this.to.set(pl.x, 0, pl.z); this.to.y = heightAt(pl.x, pl.z);
    a.mem['low'] = 1; a.mem['snarl'] = 1;
    this.sig();
    this.env.sound('bear_growl', a.position);
  }
  /** phase 2: up a ledge you cannot reach */
  private retreat(a: Animal): void {
    let best: Ledge | null = null, bd = -1;
    for (const l of this.env.ledges) { const up = l.y - heightAt(l.x, l.z); const d = Math.hypot(l.x - a.position.x, l.z - a.position.z); if (up > 2.5 && d < 25 && d > bd) { bd = d; best = l; } }
    if (best !== null) { this.from.copy(a.position); this.to.set(best.x, best.y, best.z); this.st = 'leap'; this.stT = 0; this.goal = { x: best.x, z: best.z, y: best.y }; }
  }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a) return;
    this.ring.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    // aware (inside 60 m) it already stalks you — down off the rock, along the ledges; the fight starts at 25 m
    if ((this.st === 'lurk' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.env.player.position) < this.def.awareR)) { this.st = 'stalk'; this.cd = 1.5; }
    this.stT += dt;
    // stand on the ledge / rock under it (the Crags' ledges are platforms, not terrain)
    if (this.st !== 'leap') a.yOffset += ((this.standY(a.position.x, a.position.z) - heightAt(a.position.x, a.position.z)) - a.yOffset) * Math.min(1, dt * 10);
    if (this.st === 'tell') {
      this.ring.ring(this.to.x, this.to.z, 2.2, 0.6 + 0.4 * Math.min(1, this.stT / 0.3));
      if (this.stT > 1.0) { this.st = 'leap'; this.stT = 0; this.goal = null; this.from.copy(a.position); this.from.y = this.standY(a.position.x, a.position.z); }
    } else if (this.st !== 'leap') this.ring.hide();
    if (this.st === 'leap') {
      // a ballistic arc from the perch to the ring (or up to a retreat ledge)
      const T = 0.6, k = Math.min(1, this.stT / T);
      const x = THREE.MathUtils.lerp(this.from.x, this.to.x, k), z = THREE.MathUtils.lerp(this.from.z, this.to.z, k);
      const y = THREE.MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * 1.6;
      a.position.x = x; a.position.z = z; a.yOffset = y - heightAt(x, z);
      a.yaw = a.desiredYaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      a.mem['leap'] = Math.sin(k * Math.PI) * 0.6 + 0.4; a.mem['low'] = 0;
      if (k >= 1) {
        a.mem['leap'] = 0; a.mem['snarl'] = 0;
        this.ring.hide();
        if (this.goal !== null) { this.st = 'perch'; this.cd = 3.5; return; }
        const p = this.env.player.position;
        if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < 1.9) {
          this.env.hurt(a, 35); this.env.knock(p.x - this.from.x, p.z - this.from.z);
          this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 2.5; if (this.p2) this.retreat(a);
        } else { this.st = 'open'; this.stT = 0; this.env.feed('Aqbars skids — OPEN'); }
      }
    }
    if (this.st === 'open') { a.mem['low'] = 0.1; if (this.stT > 1.5) { this.st = 'stalk'; this.cd = 1.2; } }
    if (this.st === 'perch' && this.p2 && this.stT > 4 && this.cd <= 0) this.st = 'stalk';
  }
}

// ─────────────────────────────── E2 · Kokbori, Mother of the Pack ───────────────────────────────

type KbSt = 'den' | 'hold' | 'howl' | 'hunt' | 'home';
class Kokbori extends Base {
  private st: KbSt = 'den';
  private pack: Pack | null = null;
  private howlT = 8; private stT = 0; private howlHit = -1; private cd = 0; private bit = false;
  private rings: GroundTell;
  constructor(def: EliteDef, env: Env) { super(def, env); this.rings = new GroundTell(env.game.scene, 'ring', new THREE.Color(0.9, 1.15, 1.4)); }
  override spawn(): void {
    const c = this.def.lair;
    const a = this.spawnAt(KOKBORI, 'kokbori', c.x, c.z, Math.PI);
    a.mem['howl'] = 0;
    this.st = 'den'; this.howlT = 8;
    this.pack = this.env.wildlife?.spawnPack(c.x - 6, c.z + 4, ['grey', 'tawny', 'grey', 'dark', 'scout']) ?? null;
    if (this.pack) { this.pack.homeX = c.x; this.pack.homeZ = c.z; }
  }
  override despawn(): void {
    this.rings.hide();
    if (this.pack) for (const w of this.pack.members) if (w.alive) retire(this.env.animals, w);
    this.pack = null;
    super.despawn();
  }
  override reset(): void { super.reset(); this.st = 'home'; this.rings.hide(); if (this.animal) this.animal.mem['howl'] = 0; }
  override enterPhase2(): void {
    super.enterPhase2();
    const a = this.animal;
    if (this.pack && a) { this.pack.homeX = a.position.x; this.pack.homeZ = a.position.z; this.pack.phase = 'regroup'; }
    this.st = 'hunt'; this.cd = 1;
    this.env.feed('Kokbori calls the pack back — and comes for you');
  }
  protected override damage(a: Animal, p: THREE.Vector3): number {
    // the weak point: an arrow from HIDDEN (crouched in tall grass) — and she is never soft in the howl
    const pl = this.env.player.position;
    const hidden = wildEnv.playerCrouched && wildEnv.grassHeightAt(pl.x, pl.z) > 0.6;
    void a;
    return !this.melee(p) && hidden ? 2 : 1;
  }
  protected override think(a: Animal, c: ThinkCtx): void {
    const tp = this.toPlayer(a);
    a.lookTarget.copy(c.player); a.lookWeight = 1;
    this.cd -= c.dt;
    switch (this.st) {
      case 'den': a.setMotion(tp.yaw, 0, 1.5); break;
      case 'home': this.goHome(a, 6); if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 4) this.st = 'den'; break;
      case 'hold': {
        // 24–32 m out (close enough to read her over the grass), sliding round you — and off your line of sight when you look at her
        const lookX = wildEnv.playerFwdX, lookZ = wildEnv.playerFwdZ;
        const ux = (a.position.x - c.player.x) / Math.max(1, tp.d), uz = (a.position.z - c.player.z) / Math.max(1, tp.d);
        const watched = lookX * ux + lookZ * uz > 0.9;
        const side = watched ? 1 : 0;
        const r = THREE.MathUtils.clamp(tp.d, 24, 32);
        const ang = Math.atan2(ux, uz) + side * 0.6;
        const gx = c.player.x + Math.sin(ang) * r, gz = c.player.z + Math.cos(ang) * r;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        a.setMotion(gd > 2 ? Math.atan2(gx - a.position.x, gz - a.position.z) : tp.yaw, gd > 2 ? (watched ? 7 : 4) : 0, 3);
        a.mem['low'] = watched ? 0.6 : 0.2;
        break;
      }
      case 'howl': a.setMotion(a.yaw, 0, 1); break;
      case 'hunt': {
        a.mem['low'] = 0; a.mem['snarl'] = tp.d < 8 ? 1 : 0;
        if (a.attackPhase >= 0) {
          a.setMotion(tp.yaw, 6, 4);
          if (a.attackPhase >= 0.7 && !this.bit) { this.bit = true; if (tp.d < 3.2) this.env.hurt(a, 22); }
          if (a.attackPhase >= 1) { a.cancelAttack(); this.cd = 1.8; }
          break;
        }
        if (tp.d < 3.5 && this.cd <= 0) { this.bit = false; a.startAttack(0.9); break; }
        a.setMotion(tp.yaw, tp.d > 2.5 ? 8 : 0, 3.5);
        break;
      }
      default: break;
    }
  }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a) return;
    this.rings.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if (engaged && (this.st === 'den' || this.st === 'home')) { this.st = this.p2 ? 'hunt' : 'hold'; this.howlT = 3; }
    this.stT += dt;
    if (this.st === 'hold' && !this.p2) {
      this.howlT -= dt;
      if (this.howlT <= 0) { this.st = 'howl'; this.stT = 0; this.howlHit = a.lastHitT; this.sig(); this.env.sound('wolf_howl', a.position); }
    }
    if (this.st === 'howl') {
      a.mem['howl'] = Math.min(1, this.stT / 0.3);
      // pale rings ripple out from her
      this.rings.ring(a.position.x, a.position.z, 2 + ((this.stT * 11) % 12), 0.85 * (1 - ((this.stT * 11) % 12) / 12));
      if (a.lastHitT > this.howlHit) {
        // hit mid-howl: it breaks — she staggers, the pack scatters
        a.mem['howl'] = 0; this.rings.hide();
        _v.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).negate(); a.stagger(_v, 1);
        this.pack?.scare(a.position.x, a.position.z, 80);
        this.env.feed('The howl breaks — the pack scatters');
        this.st = 'hold'; this.howlT = 12;
      } else if (this.stT > 1.2) {
        a.mem['howl'] = 0; this.rings.hide();
        if (this.pack) { this.pack.awareness = 1; this.pack.phase = 'encircle'; }
        this.env.feed('PACK HOWL — the pack closes in');
        this.st = 'hold'; this.howlT = 11 + Math.random() * 4;
      }
    } else if (a.mem['howl'] !== 0) a.mem['howl'] = 0;
  }
}

// ─────────────────────────────── E3 · Qyran the Storm-Wing ───────────────────────────────

type QySt = 'soar' | 'tell' | 'stoop' | 'ground' | 'climb';
class Qyran extends Base {
  private st: QySt = 'soar';
  private stT = 0; private stoopT = 8; private ang = 0;
  private centre = new THREE.Vector3(); private tgt = new THREE.Vector3();
  private line: THREE.Mesh; private lineMat: FxMaterial;
  /** engaged: he circles over YOU, 24 m (phase 2: 36 m) above your head — not over the rock's top, a speck from its foot */
  private overYou = false;
  constructor(def: EliteDef, env: Env) {
    super(def, env);
    const g = new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true); g.translate(0, 0.5, 0);
    this.lineMat = fxMaterial(FX.beam, new THREE.Color(2.4, 1.7, 0.5), 0);
    this.lineMat.depthTest = false;
    this.line = new THREE.Mesh(g, this.lineMat); this.line.visible = false; this.line.frustumCulled = false; this.line.renderOrder = 31;
    env.game.scene.add(this.line);
  }
  private cruise(): number {
    if (!this.overYou) return EAGLE_ROCK.top + (this.p2 ? 52 : 34);
    // over you — but never inside the rock's flank the orbit swings across: 18 m clear of the ground under him
    const a = this.animal, over = a ? heightAt(a.position.x, a.position.z) + 18 : -Infinity;
    return Math.max(this.env.player.position.y + (this.p2 ? 36 : 24), over);
  }
  override spawn(): void {
    this.centre.set(EAGLE_ROCK.x, 0, EAGLE_ROCK.z);
    const a = this.spawnAt(EAGLE, 'qyran', EAGLE_ROCK.x + 26, EAGLE_ROCK.z, 0);
    a.mem['altY'] = this.cruise(); a.mem['flap'] = 0.3;
    this.st = 'soar'; this.stoopT = 8;
  }
  override despawn(): void { this.line.visible = false; this.env.bar.chevron(null, this.env.game.camera); super.despawn(); }
  override reset(): void { super.reset(); this.st = 'climb'; this.line.visible = false; }
  protected override damage(a: Animal, p: THREE.Vector3): number {
    if (this.st === 'ground') return isHead(a, p) ? 1 : 2.5;       // grounded: every hit a headshot
    return 1;
  }
  protected override think(a: Animal, c: ThinkCtx): void { a.lookTarget.copy(c.player); a.lookWeight = 1; a.setMotion(a.yaw, 0, 1); }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a) return;
    this.lineMat.uniforms.uTime.value = t;
    this.stT += dt;
    const p = this.env.player.position, m = a.mem;
    // the orbit centre: over you while engaged, back over the rock otherwise; always drifting downwind
    const home = leashing || !engaged;
    this.overYou = !home;
    const cx = home ? EAGLE_ROCK.x : p.x, cz = home ? EAGLE_ROCK.z : p.z;
    this.centre.x += (cx + wildEnv.wind.x * 12 - this.centre.x) * Math.min(1, dt * 0.4);
    this.centre.z += (cz + wildEnv.wind.z * 12 - this.centre.z) * Math.min(1, dt * 0.4);
    const R = 22;
    switch (this.st) {
      case 'soar': case 'climb': {
        this.ang += dt * 12 / R;
        const tx = this.centre.x + Math.cos(this.ang) * R, tz = this.centre.z + Math.sin(this.ang) * R;
        const k = this.st === 'climb' ? 1.5 : 3;
        a.position.x += (tx - a.position.x) * Math.min(1, dt * k); a.position.z += (tz - a.position.z) * Math.min(1, dt * k);
        a.yaw = a.desiredYaw = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang));
        const cruise = this.cruise();
        const alt = m['altY'] ?? cruise;
        m['altY'] = this.st === 'climb' ? Math.min(cruise, alt + 9 * dt) : alt + (cruise + 2 * Math.sin(t * 0.5) - alt) * Math.min(1, dt * 0.6);
        m['flap'] = this.st === 'climb' ? 0.9 : 0.18 + 0.12 * Math.max(0, Math.sin(t * 0.6)); m['fold'] = 0; m['ground'] = 0; m['bank'] = 0.35;
        if (this.st === 'climb' && (m['altY'] ?? 0) >= cruise - 0.5) this.st = 'soar';
        if (engaged && this.st === 'soar') { this.stoopT -= dt; if (this.stoopT <= 0) { this.st = 'tell'; this.stT = 0; this.sig(); this.env.sound('monkey_shriek', a.position); } }
        break;
      }
      case 'tell': {
        // hangs on the wind, wings half folding; a gold line streaks from it to you, the chevron at the screen edge
        const T = this.p2 ? 0.9 : 1.2;
        m['flap'] = 0.7; m['fold'] = 0.4 * (this.stT / T); m['bank'] = 0;
        a.yaw = a.desiredYaw = Math.atan2(p.x - a.position.x, p.z - a.position.z);
        a.headWorld(_v);
        _w.set(p.x, p.y + 1.2, p.z);
        this.aim(_v, _w, 0.4 + 0.6 * (this.stT / T));
        this.env.bar.chevron(_v, this.env.game.camera);
        if (this.stT >= T) { this.st = 'stoop'; this.stT = 0; this.tgt.set(p.x, p.y + 0.9, p.z); }
        break;
      }
      case 'stoop': {
        m['fold'] = 1; m['flap'] = 0;
        _v.set(a.position.x, m['altY'] ?? 0, a.position.z);
        _w.copy(this.tgt).sub(_v);
        const L = _w.length(), step = 40 * dt;
        this.aim(_v, this.tgt, 0.5);
        this.env.bar.chevron(_v, this.env.game.camera);
        if (L <= step + 0.6) {
          this.line.visible = false; this.env.bar.chevron(null, this.env.game.camera);
          a.position.x = this.tgt.x; a.position.z = this.tgt.z;
          if (Math.hypot(p.x - this.tgt.x, p.z - this.tgt.z) < 2.4 && p.y - heightAt(p.x, p.z) < 1.5) {
            this.env.hurt(a, 30); this.env.knock(p.x - _v.x, p.z - _v.z);
            this.st = 'climb'; m['altY'] = this.tgt.y + 2;
          } else { this.st = 'ground'; this.stT = 0; m['altY'] = heightAt(a.position.x, a.position.z) + 0.55 * a.scale; this.env.feed('Qyran is GROUNDED'); }
          this.stoopT = this.p2 ? 4.5 + Math.random() * 1.5 : 7 + Math.random() * 2;
        } else {
          _w.multiplyScalar(step / L);
          a.position.x += _w.x; a.position.z += _w.z; m['altY'] = (m['altY'] ?? 0) + _w.y; m['altS'] = m['altY'];
          a.yaw = a.desiredYaw = Math.atan2(_w.x, _w.z);
        }
        break;
      }
      case 'ground': {
        m['ground'] = 1; m['fold'] = 0; m['flap'] = 0;
        m['altY'] = heightAt(a.position.x, a.position.z) + 0.42 * a.scale;
        if (this.stT > 2) { this.st = 'climb'; m['ground'] = 0; }
        break;
      }
      default: break;
    }
    if (this.st !== 'tell' && this.st !== 'stoop') { this.line.visible = false; this.env.bar.chevron(null, this.env.game.camera); }
  }
  /** the gold line from `from` to `to` */
  private aim(from: THREE.Vector3, to: THREE.Vector3, alpha: number): void {
    _h.subVectors(to, from);
    const L = _h.length();
    this.line.position.copy(from);
    this.line.scale.set(1, L, 1);
    this.line.quaternion.setFromUnitVectors(_up, _h.normalize());
    this.lineMat.uniforms.uAlpha.value = alpha;
    this.line.visible = true;
  }
}

// ─────────────────────────────── E5 · Qara Batyr the Unburied ───────────────────────────────

export const GHOST_HORSE = 'ghost-rider';   // B11's kind: when B11 is in the tree its captain rig IS this species
/** the ghost captain's horse: the creature row's horse rig, its own kind (the herd AI leaves it to the elite) */
function registerGhostHorse(): void {
  if (hasSpecies(GHOST_HORSE) || !hasSpecies('horse')) return;
  const H = speciesDef('horse');
  const base = H.variants.find((v) => v.id === 'black') ?? H.variants[0];
  if (base === undefined) return;
  registerSpecies({
    ...H, kind: GHOST_HORSE, label: 'Qara Batyr',
    variants: [{ ...base, id: 'captain', label: 'Qara Batyr the Unburied', weight: 1, rarity: 'legendary', scale: [1.15, 1.15], hp: 800, traits: { ...base.traits, mane: 1.8 } }],
    think: eliteThink, damageMul: eliteDamageMul,
  });
}

/** B11's ghost riders (src/nalati/ghostRiders.ts) — the captain's rig, his line, the spawn rule. Structural: B11 owns it */
export interface GhostsApi {
  spawnRider: (o: { x: number; z: number; yaw: number; variant?: 'rider' | 'captain' }) => Animal | null;
  spawnLine: (o: { count?: number; captain?: boolean; at?: number }) => Animal[];
  dissolve: (a: Animal) => void;
  readonly killsTonight: number;
}

type QbSt = 'wait' | 'circle' | 'wheel' | 'charge' | 'open' | 'home';
class QaraBatyr extends Base {
  private st: QbSt = 'wait';
  private stT = 0; private chargeT = 6; private pairs = 0;
  private lane: GroundTell;
  private rider: THREE.Group | null = null;
  private line: Animal[] = [];
  private c0 = new THREE.Vector3(); private c1 = new THREE.Vector3();
  private struck = false;
  constructor(def: EliteDef, env: Env) { super(def, env); this.lane = new GroundTell(env.game.scene, 'lane', new THREE.Color(0.35, 1.6, 1.9)); }
  /** "once you have killed 5 ghost riders in a night" — the next line forms with him at its head */
  canSpawn(): boolean { return this.env.ghosts === null || this.env.ghosts.killsTonight >= 5; }
  override spawn(): void {
    const c = this.def.lair, g = this.env.ghosts;
    if (g !== null) {
      // B11's captain rig: the ghost material, the seated rider with the tug standard; steered through mem.tx / tz / v
      const a = g.spawnRider({ x: c.x, z: c.z, yaw: 0, variant: 'captain' });
      if (a === null) return;
      this.animal = a;
      setEliteDamage(a, (an, p) => this.damage(an, p));
    } else {
      // no B11 wired: the fallback — the horse rig in a ghost material, a rider of our own
      registerGhostHorse();
      const a = this.spawnAt(GHOST_HORSE, 'captain', c.x, c.z, 0);
      ghostly(a);
      if (this.rider === null) { this.rider = riderModel(this.env.sky); this.env.game.scene.add(this.rider); }
      this.rider.visible = true;
    }
    this.st = 'wait';
  }
  override despawn(): void {
    this.lane.hide(); if (this.rider) this.rider.visible = false;
    const g = this.env.ghosts, a = this.animal;
    for (const r of this.line) if (r.alive) g?.dissolve(r);
    this.line = [];
    if (g !== null && a !== null) { g.dissolve(a); this.animal = null; } else super.despawn();
  }
  override reset(): void { super.reset(); this.st = 'home'; this.lane.hide(); }
  protected override damage(_a: Animal, p: THREE.Vector3): number { return this.st === 'open' && this.melee(p) ? 3 : 1; }
  /** the fallback rig's brain: the same puppet as B11's (steer to mem.tx / tz at mem.v) */
  protected override think(a: Animal, c: ThinkCtx): void {
    const m = a.mem, tx = m['tx'], tz = m['tz'];
    a.lookTarget.copy(c.player); a.lookWeight = 0.5;
    if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
    const dx = tx - a.position.x, dz = tz - a.position.z;
    a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : m['v'] ?? 9, m['turn'] ?? 2.4);
  }
  /** the ghost-fire lane from him towards you — drawn to 3 m short of you (the charge still runs 12 m past) */
  private drawLane(p: THREE.Vector3, alpha: number): void {
    const dx = p.x - this.c0.x, dz = p.z - this.c0.z, d = Math.hypot(dx, dz);
    if (d < 4) { this.lane.hide(); return; }
    const k = (d - 3) / d;
    this.lane.lane(this.c0.x, this.c0.z, this.c0.x + dx * k, this.c0.z + dz * k, 2.6, alpha);
  }
  private steer(a: Animal, x: number, z: number, v: number, turn: number): void { a.mem['tx'] = x; a.mem['tz'] = z; a.mem['v'] = v; a.mem['turn'] = turn; }
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a) return;
    this.lane.setTime(t);
    if (this.rider) { horseSaddle(a, this.rider.position); this.rider.rotation.y = a.yaw; }
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'wait' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.env.player.position) < this.def.awareR * 0.8)) {
      this.st = 'circle'; this.chargeT = 3;
      // his riders ride with him and loose their volleys (B11's line AI)
      if (this.env.ghosts !== null && this.line.every((r) => !r.alive)) this.line = this.env.ghosts.spawnLine({ count: 3 });
    }
    this.stT += dt;
    const p = this.env.player.position;
    switch (this.st) {
      case 'wait': this.steer(a, a.position.x, a.position.z, 0, 1.5); break;
      case 'home':
        this.steer(a, this.def.lair.x, this.def.lair.z, 9, 2.4);
        if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 5) this.st = 'wait';
        break;
      case 'circle': {
        // gallop a ring round you, 22 m out
        const ang = Math.atan2(a.position.x - p.x, a.position.z - p.z) + 0.55;
        this.steer(a, p.x + Math.sin(ang) * 22, p.z + Math.cos(ang) * 22, 10, 2.2);
        this.chargeT -= dt;
        if (this.chargeT <= 0) { this.st = 'wheel'; this.stT = 0; this.sig(); }
        break;
      }
      case 'wheel': {
        // the lane of ghost-fire: from him, through you, 12 m on — then he comes down it
        this.steer(a, p.x, p.z, 0.01, 5);
        this.c0.copy(a.position);
        const dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz) || 1;
        this.c1.set(p.x + dx / d * 12, 0, p.z + dz / d * 12);
        this.drawLane(p, 0.22 + 0.2 * Math.min(1, this.stT / 0.4));
        if (this.stT > 1.3) { this.st = 'charge'; this.stT = 0; this.struck = false; this.env.sound('horse_squeal', a.position); }
        break;
      }
      case 'charge': {
        this.steer(a, this.c1.x, this.c1.z, 18, 0.6);
        this.drawLane(p, 0.36);
        if (!this.struck && Math.hypot(p.x - a.position.x, p.z - a.position.z) < 1.9 && p.y - heightAt(p.x, p.z) < 1.6) {
          this.struck = true; this.env.hurt(a, 38); this.env.knock(this.c1.x - this.c0.x, this.c1.z - this.c0.z);
        }
        const along = ((a.position.x - this.c0.x) * (this.c1.x - this.c0.x) + (a.position.z - this.c0.z) * (this.c1.z - this.c0.z)) / Math.max(1, this.c0.distanceToSquared(this.c1));
        if (along >= 0.97 || this.stT > 4) {
          this.lane.hide();
          if (!this.struck) { this.st = 'open'; this.stT = 0; this.env.feed('He passes — his back is OPEN'); }
          else this.nextCharge();
        }
        break;
      }
      case 'open':
        this.steer(a, a.position.x + Math.sin(a.yaw) * 6, a.position.z + Math.cos(a.yaw) * 6, 3, 1);
        if (this.stT > 2) this.nextCharge();
        break;
      default: break;
    }
  }
  private nextCharge(): void {
    // phase 2: the charges come in pairs
    if (this.p2 && this.pairs === 0) { this.pairs = 1; this.st = 'wheel'; this.stT = 0; return; }
    this.pairs = 0; this.st = 'circle'; this.chargeT = this.p2 ? 4.5 : 6.5;
  }
}

/** the ghost look: translucent teal with a glow (the horse's own material instance) */
function ghostly(a: Animal): void {
  const mats = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
  for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.transparent = true; m.opacity = 0.72; m.emissive.setRGB(0.1, 0.55, 0.62); m.emissiveIntensity = 0.9; m.color.setRGB(0.55, 0.85, 0.9); }
}

/** the captain in the saddle: a glaive, a spiked helm, a cloak, the horsetail standard (tug) on his back — ghost teal */
function riderModel(sky: Sky): THREE.Group {
  const kit = new PaintKit(0x9a7a);
  const teal = new THREE.Color(0.55, 0.9, 0.95), dark = new THREE.Color(0.2, 0.42, 0.48);
  kit.add(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 12), teal, { matrix: M(0, 0.45, -0.02) });          // torso
  kit.add(new THREE.CylinderGeometry(0.3, 0.42, 0.9, 12, 1, true), dark, { matrix: M(0, 0.25, -0.12) });  // the cloak
  kit.add(new THREE.SphereGeometry(0.14, 12, 10), teal, { matrix: M(0, 0.95, 0) });                    // head
  kit.add(new THREE.ConeGeometry(0.15, 0.35, 12), dark, { matrix: M(0, 1.14, 0) });                   // the spiked helm
  for (const sx of [1, -1]) kit.add(pole(v3(sx * 0.22, 0.72, 0), v3(sx * 0.3, 0.35, 0.28), 0.06, 0.05, 6), teal);
  kit.add(pole(v3(-0.3, 0.1, 0.6), v3(0.1, 1.6, -0.3), 0.025, 0.025, 6), dark);                       // the glaive
  kit.add(new THREE.ConeGeometry(0.06, 0.5, 6), teal, { matrix: M(0.12, 1.75, -0.36, 0, 1, 1, 1, -0.25) });
  kit.add(pole(v3(0.05, 0.3, -0.25), v3(0.05, 2.3, -0.4), 0.02, 0.02, 5), dark);                        // the standard's pole
  for (let i = 0; i < 7; i++) kit.add(pole(v3(0.05, 2.25, -0.4), v3(0.05 + Math.sin(i) * 0.12, 1.55 - i * 0.03, -0.55 - (i % 3) * 0.08), 0.03, 0.005, 4), new THREE.Color(0.85, 0.95, 0.95));
  // the painterly material, glowing and translucent (a uniform-only variant: same program)
  const mat = painterlyMaterial(sky, { rim: 0.8, emissive: new THREE.Color(0.08, 0.42, 0.48), transparent: true, opacity: 0.75 });
  const mesh = new THREE.Mesh(kit.finish(), mat);
  mesh.position.y = -0.25;
  const g = new THREE.Group(); g.add(mesh); g.name = 'qara-batyr-rider';
  return g;
}

// ─────────────────────────────── E4a · Argymaq the Unbroken ───────────────────────────────

export const ARGYMAQ = 'argymaq';
function registerArgymaq(): void {
  if (hasSpecies(ARGYMAQ) || !hasSpecies('horse')) return;
  const H = speciesDef('horse');
  const base = H.variants.find((v) => v.id === 'stallion') ?? H.variants[0];
  if (base === undefined) return;
  // his own kind, the horse's rig + the HERD's brain (he leads his herd): variant id 'stallion' so HorseHerd reads him so
  registerSpecies({ ...H, kind: ARGYMAQ, label: 'Argymaq', variants: [{ ...base, id: 'stallion', label: 'Argymaq the Unbroken', weight: 1, rarity: 'legendary', scale: [1.3, 1.3], hp: 750, traits: { ...base.traits, mane: 2.2, scar: 1 } }] });
}

class Argymaq extends Base {
  private herd: HorseHerd | null = null;
  private lane: GroundTell;
  private laneT = 0; private runT = 0; private lastState = '';
  private laneFrom = new THREE.Vector3(); private laneTo = new THREE.Vector3();
  constructor(def: EliteDef, env: Env) { super(def, env); this.lane = new GroundTell(env.game.scene, 'lane', new THREE.Color(2.4, 0.9, 0.35)); }
  override spawn(): void {
    registerArgymaq();
    const w = this.env.wildlife, c = this.def.lair;
    if (w === null || !hasSpecies(ARGYMAQ)) return;
    const herd = w.spawnHerd(c.x - 8, c.z + 6, 8, 1, false);
    const a = this.env.animals.spawn(ARGYMAQ, c.x, c.z, 0, 'stallion');
    const hi = herd.members[0]?.herd ?? -1;
    a.herd = hi; if (hi >= 0) this.env.animals.herds[hi]?.members.push(a);
    herd.members.push(a); herd.stallion = a;
    // the blue-black coat
    const mats = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
    for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) m.color.setRGB(0.62, 0.64, 0.72);
    this.herd = herd; this.animal = a;
  }
  override despawn(): void { /* he lives on the pasture; he never leaves */ }
  broken(): boolean { return this.herd?.stallionState === 'beaten'; }
  barFrac(): number { const a = this.animal; return a ? Math.max(0, (a.hp / a.maxHp - 0.25) / 0.75) : 0; }
  override tick(dt: number, t: number, engaged: boolean): void {
    const a = this.animal, h = this.herd;
    if (!a || !h) return;
    this.lane.setTime(t);
    // TRAMPLE: he rears (the herd's 'display') → the lane paints from his hooves to you; it holds through the charge
    const st = h.stallionState;
    if (st !== this.lastState) {
      if (st === 'display') { this.laneT = 1.2; this.laneFrom.copy(a.position); this.laneTo.copy(this.env.player.position); this.sig(); }
      if (st === 'charge') this.laneT = Math.max(this.laneT, 1.4);
      this.lastState = st;
    }
    if (this.laneT > 0) {
      this.laneT -= dt;
      const dx = this.laneTo.x - this.laneFrom.x, dz = this.laneTo.z - this.laneFrom.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, d - 3) / d;   // to 3 m short of where you stood (no wash over your own feet)
      this.lane.lane(this.laneFrom.x, this.laneFrom.z, this.laneFrom.x + dx * k, this.laneFrom.z + dz * k, 3, 0.55 * Math.min(1, this.laneT * 2));
    } else this.lane.hide();
    // phase 2: HE RUNS — the herd at the gallop round the pasture, him at its head
    if (this.p2 && engaged && st !== 'beaten') { this.runT -= dt; if (this.runT <= 0) { this.runT = 8; h.leadAway(this.env.player.position.x, this.env.player.position.z); } }
    // tamed (the taming row's flow bonded the horse he became): the reward is the horse — Argymaq's size, and his lair retires
    const tm = this.env.taming;
    const tul = tm?.phase === 'bonded' && h.stallion !== a ? tm.tulpar : null;
    if (tul !== null) {
      tul.scale = 1.3; tul.mesh.scale.setScalar(1.3);
      this.env.record(ARGYMAQ, 'stallion');
      this.env.elites.won(this.def.id);
      this.env.feed('Argymaq is yours — the best horse in Nalati');
      this.herd = null;
    }
  }
}

// ─────────────────────────────── trophies (the orb's display model) ───────────────────────────────

function trophyModel(id: string, sky: Sky): THREE.Object3D {
  const kit = new PaintKit(0x7e0 + id.length);
  const rng = kit.rng;
  switch (id) {
    case 'aqbars': case 'kokbori': {
      // a folded pelt with its tail
      const col = id === 'aqbars' ? new THREE.Color('#d8d4ca') : new THREE.Color('#9aa4b0');
      kit.add(blob(0.32, rng, 2, 0.35, 0.2), (p) => (id === 'aqbars' && Math.sin(p.x * 30) * Math.sin(p.z * 30) > 0.55 ? new THREE.Color('#3a3a3c') : col), { matrix: M(0, 0, 0, 0, 1.3, 1, 0.9) });
      kit.add(pole(v3(-0.3, 0.02, 0), v3(-0.75, 0.1, 0.25), 0.07, 0.05, 8), col);
      break;
    }
    case 'qyran':
      kit.add(pole(v3(0, -0.4, 0), v3(0, 0.45, 0), 0.012, 0.004, 5), new THREE.Color('#e7d9b0'));
      kit.add(blob(0.25, rng, 2, 0.12, 0.1), (p) => (p.y > 0.1 ? new THREE.Color('#f0b44a') : new THREE.Color('#5a3a20')), { matrix: M(0, 0.05, 0, 0, 0.35, 1.7, 1) });
      break;
    case 'qara-batyr':
      kit.add(pole(v3(0, -0.5, 0), v3(0, 0.5, 0), 0.02, 0.02, 6), new THREE.Color('#2a3a40'));
      for (let i = 0; i < 9; i++) kit.add(pole(v3(0, 0.45, 0), v3(Math.sin(i) * 0.14, -0.05 - (i % 3) * 0.06, Math.cos(i) * 0.14), 0.035, 0.006, 4), new THREE.Color('#bfe8ea'));
      break;
    default:
      for (let i = 0; i < 3; i++) kit.add(pole(v3((i - 1) * 0.05, 0.4, 0), v3((i - 1) * 0.08, -0.4, 0.05), 0.03, 0.02, 6), new THREE.Color('#141416'));
  }
  const mat = painterlyMaterial(sky, { rim: 0.6 });
  const g = new THREE.Group(); g.add(new THREE.Mesh(kit.finish(), mat));
  return g;
}

// ─────────────────────────────── the wiring ───────────────────────────────

/** dev (`?elite=`): where to stand — a unit direction from the elite, a distance, the camera pitch */
const DEV_FROM: Record<string, { dx: number; dz: number; d: number; pitch: number }> = {
  aqbars: { dx: 0.93, dz: 0.37, d: 30, pitch: 0.1 },           // the open grass west of the Crags' foot, below the cave (it comes down)
  kokbori: { dx: -1, dz: 0, d: 45, pitch: 0.02 },              // east of the den, in the basin's grass
  qyran: { dx: 0, dz: 1, d: 40, pitch: 0.5 },                  // north of Eagle Rock, looking up at the circling bird
  'qara-batyr': { dx: 0.6, dz: -0.8, d: 30, pitch: 0.03 },
  argymaq: { dx: 0.8, dz: 0.6, d: 30, pitch: 0.05 },
};


export interface ElitesCtx {
  game: Game; sky: Sky; player: Player;
  ledges: Ledge[];
  /** the day clock's phase ('dawn' | 'day' | 'golden' | 'dusk' | 'night') and the storm (B10's NalatiWeather) */
  phase: () => string;
  storm: () => boolean;
}

export interface ElitesPlay {
  animals: AnimalManager;
  wildlife: Wildlife | null;
  /** B8's taming (src/game/Taming.ts) — Argymaq hands over to it when BROKEN; null until it is wired */
  taming: { phase: string; tulpar: Animal | null } | null;
  /** B11's ghost riders (Qara Batyr rides their captain rig, his line rides with him); null until it is wired */
  ghosts: GhostsApi | null;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  addItem: (id: ItemId) => void;
  /** Progress.recordKill — Argymaq is tamed, not killed, so his achievement is recorded here */
  record: (kind: string, variant: string) => void;
  sting?: (event: 'banner' | 'phase2' | 'kill') => void;
  pickupHum?: (inside: boolean) => void;
  sound?: (name: EliteSound, at: THREE.Vector3) => void;
  params: URLSearchParams;
}

export class NalatiElites {
  bar: EliteBar | null = null;
  elites: Elites | null = null;
  scripts: EliteScript[] = [];
  /** the skins won (B15 wears them): persisted by the elite system; mirrored here for the menu */
  readonly skins = new Set<string>();
  /** B11's ghost riders, handed in by src/nalati/index.ts (main.ts never sees them); `play.ghosts` wins when given */
  ghosts: GhostsApi | null = null;
  constructor(private readonly ctx: ElitesCtx) {}

  bind(play: ElitesPlay): void {
    const { game, sky, player } = this.ctx;
    const bar = new EliteBar();
    this.bar = bar;
    const condition = (rule: EliteRule): boolean => {
      const ph = this.ctx.phase();
      return rule === 'always' ? true : rule === 'storm' ? this.ctx.storm() : rule === 'night' ? ph === 'night' : ph === 'dusk' || ph === 'night';
    };
    const elites = new Elites({
      scene: game.scene, camera: game.camera, renderer: game.renderer, player, condition,
      addInteractable: (it) => { play.interactables.push(it); },
      removeInteractable: (it) => { const i = play.interactables.indexOf(it); if (i !== -1) play.interactables.splice(i, 1); },
      toast: play.toast,
      ...(play.sting ? { sting: play.sting } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
      ownSkin: (s) => { this.skins.add(s); },
    }, bar);
    this.elites = elites;
    const env: Env = {
      game, sky, player, animals: play.animals, elites, bar, wildlife: play.wildlife, taming: play.taming, ghosts: play.ghosts ?? this.ghosts, ledges: this.ctx.ledges,
      hurt: (a, dmg) => { play.animals.onCharge?.(a, dmg); },
      knock: (dx, dz) => { const l = Math.hypot(dx, dz) || 1; wildEnv.onKnockdown?.(dx / l, dz / l, 1); },
      feed: play.feed, addItem: play.addItem, record: play.record,
      sound: (name, at) => { play.sound?.(name, at); },
    };
    this.scripts = [
      new Aqbars(ELITE_DEFS['aqbars'] ?? fail('aqbars'), env),
      new Kokbori(ELITE_DEFS['kokbori'] ?? fail('kokbori'), env),
      new Qyran(ELITE_DEFS['qyran'] ?? fail('qyran'), env),
      new QaraBatyr(ELITE_DEFS['qara-batyr'] ?? fail('qara-batyr'), env),
      new Argymaq(ELITE_DEFS['argymaq'] ?? fail('argymaq'), env),
    ];
    for (const s of this.scripts) { elites.add(s); if (elites.owned(s.def.id)) this.skins.add(s.def.drop.skin); }
    // build the new rigs' models now (a first spawn mid-hunt must not stall a frame)
    for (const [k, v] of [[LEOPARD, 'aqbars'], [EAGLE, 'qyran'], [KOKBORI, 'kokbori']] as const) { try { play.animals.factory.model(k, v); } catch (e) { console.warn(`[elites] ${k} did not build`, e); } }
    // dev: `?elite=<id>` — spawn it whatever its rule and put the player DEV_FROM's distance from it (`&from=<m>`), facing it
    const dev = play.params.get('elite');
    if (dev !== null) {
      // `&here=x,z` moves its lair there for this session (open ground for screenshots; the leash follows the lair)
      const here = (play.params.get('here') ?? '').split(',').map(Number);
      const def = ELITE_DEFS[dev];
      if (def && here.length === 2 && here.every((v) => Number.isFinite(v))) { def.lair.x = here[0] ?? def.lair.x; def.lair.z = here[1] ?? def.lair.z; }
      const a = elites.devSpawn(dev);
      const from = DEV_FROM[dev];
      if (a && from) {
        const d = Number(play.params.get('from')) || from.d;   // `&from=<m>`: stand farther (the aware state: banner + head bar)
        const px = a.position.x + from.dx * d, pz = a.position.z + from.dz * d;
        player.position.set(px, heightAt(px, pz), pz);
        player.yaw = Math.atan2(-(a.position.x - px), -(a.position.z - pz)); player.pitch = from.pitch;
      }
    }
    (window as unknown as { __elites: unknown }).__elites = this;
  }

  update(dt: number, t: number): void { this.elites?.update(dt, t); }
}

function fail(id: string): never { throw new Error(`elites: no def '${id}'`); }

export function wireElites(ctx: ElitesCtx): NalatiElites { return new NalatiElites(ctx); }
