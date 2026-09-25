import * as THREE from 'three';
import type { Animal } from '../entities/Animal';
import { registerSpecies, speciesDef, variantDef, hasSpecies } from '../entities/species/registry';
import { Boss, type BossDef, type BossScript, type BossState } from '../game/Boss';
import { GroundTell } from '../game/Elite';
import { BossBar } from '../ui/BossBar';
import { LightPool } from '../fx/LightPool';
import { TIER_CONFIG } from '../core/tier';
import { Impacts } from '../fx/Impacts';
import { heightAt } from '../world/Heightfield';
import { fogUniforms } from '../world/Atmosphere';
import { PINE_PHASES } from '../world/PineDayNight';
import { KINGS_CLEARING } from '../chunks/pineHollowLayout';
import type { Interactable } from '../world/Cabin';
import type { Music } from '../audio/Music';
import { FogWall, Puffs, flameCard } from './fxKit';
import { KING_VARIANT, dressAntlerKing, makeKingKit, type KingKit, type KingLook } from './kingModel';
import { own, retire, voice, LaneCharge, type PineCtx } from './ctx';
import { KING_PHASE_AT, burnTick, headingTo, inArc, ringCatches, wallPush } from './combatMath';
import type { FxMaterial } from '../world/fx';
import { shardSlot } from '../core/shardState';

/**
 * THE ANTLER KING, Warden of Pine Hollow (PINE-HOLLOW-REMASTER PH-C2; board B2 pick A, the Bark Warden). The engine's
 * boss system (src/game/Boss.ts, ported from Nalati: threshold → intro + name card → the wide bar with phase notches →
 * phase beats → checkpoints → the legendary orb) over a `BossScript` for this fight:
 *
 *   WHERE / WHEN: the King's clearing in the old-growth (KINGS_CLEARING (150, −30), flat r 30, the 7 standing stones at
 *   r 24), NIGHT ONLY (PineDayNight's night > 0.5). At night the King stands in the clearing; step inside the stones and
 *   THE FOG CLOSES — a drifting fog wall at r ≈ 31 round the clearing, the scene fog thickening, and a soft wall that
 *   shoves you back in past r 27.5 — until he falls or you do.
 *
 *   I · THE WARDEN (100 → 60 %): he walks you down. ANTLER SWEEP up close (a ring paints round him, 0.9 s → 24 in front of
 *     him). ROOT-RING STOMP (the paw wind-up, 1.0 s) → a ring of roots races out across the whole clearing — JUMP it
 *     (20 if it catches you on the ground). After a stomp the amber RIBCAGE OPENS for ~3 s: the weak point (×3; shut ×0.6;
 *     bark and skull ×0.25).
 *   II · LANTERNS FALL (60 → 30 %): his three antler lanterns drop and burn where they land (a fire ring each, 9 a bite
 *     inside); he rings his bells and calls THRALLS out of the fog (2 at a time, up to 3; the creature lane's 'thrall'
 *     variant of elk / boar, until it lands a moss-tinted bull / black boar) — they charge down lanes. Stomps come in pairs.
 *   III · THE LAST LIGHT (30 → 0 %): the clearing goes dark (fog thick and black, moon and sky light down) but for his
 *     ribcage and the lantern you carry (the fight's one pooled light moves to you); he charges DOWN LANES across the
 *     clearing, chaining two or three, the ribcage flaring open at every skid.
 *
 *   Checkpoints per phase (Boss.ts): die and you are back at the stones' N gap, bolts refilled, the King at the start of
 *   the phase you reached. The reward (the gold legendary orb, once): THE WARDEN'S LONGBOW — the bow itself (PH-C11,
 *   src/player/Longbow.ts, adapted from Nalati's Bow.ts) joins the kit, with the WARDEN crossbow skin and the
 *   'warden-longbow' pack flag that keeps it across sessions; a re-fight pays the trophy (Amber heartwood). Music: Music.ts's Pine Hollow boss slot (setPineScene('boss') / setBossPhase).
 *
 *   STAND-IN MODEL: kingModel.ts (the elk rig ×2.6, bark coat, lanterns, ribcage, skull) — `dressAntlerKing` is the one
 *   factory PH-M3's Bark Warden replaces. The King is its own kind, 'antler-king' (the journal's page answers to it).
 *
 * Dev: `?boss=antler-king` (night forced, you at the N gap, 26 m out; `&from=<m>`), `&bossPhase=2|3` (that checkpoint),
 * `&bossGod=1` (nothing hurts you). `window.__antlerKing`.
 */

export const KING_KIND = 'antler-king';
const C = KINGS_CLEARING;
const ARENA_IN = 22, WALL_R = 27.5, FOG_R = 31, KING_R = 24;
const AMBER_TELL = new THREE.Color(1.5, 0.62, 0.12), EMBER = new THREE.Color(2.6, 1.1, 0.3);
const PHASES: BossDef['phases'] = [
  { at: KING_PHASE_AT[0], caption: 'I · THE WARDEN', name: 'The Warden' },
  { at: KING_PHASE_AT[1], caption: 'II · LANTERNS FALL', name: 'Lanterns Fall' },
  { at: KING_PHASE_AT[2], caption: 'III · THE LAST LIGHT', name: 'The Last Light' },
];

let kingDamage: ((a: Animal, p: THREE.Vector3) => number) | null = null;

/** the King's species: the elk rig re-registered as 'antler-king' — its own AI (the fight drives it), no blood (bark) */
function registerKing(): void {
  if (hasSpecies(KING_KIND)) return;
  const elk = speciesDef('elk');
  registerSpecies({
    ...elk, kind: KING_KIND, label: 'The Antler King', variants: [KING_VARIANT], aggressive: true, blood: false,
    walkSpeed: 2.2, chargeSpeed: 13,
    sounds: { call: 'elk_bugle', hurt: 'bear_hurt', callEvery: [600, 900] },
    eyeGlow: [1.0, 0.55, 0.15], eyeGlowIntensity: 2.5,
    think: () => { /* the fight's update drives him (AntlerKingFight) */ },
    damageMul: (a, p) => kingDamage?.(a, p) ?? 1,
  });
}

/** a thrall of `kind`: the creature lane's 'thrall' variant when it exists, else a moss-tinted stand-in */
function thrallVariant(kind: 'elk' | 'boar'): { variant: string; tinted: boolean } {
  if (variantDef(kind, 'thrall').id === 'thrall') return { variant: 'thrall', tinted: false };
  return { variant: kind === 'elk' ? 'bull' : 'black', tinted: true };
}
const MOSS = new THREE.Color(0.5, 0.62, 0.42);
function tintThrall(a: Animal): void {
  a.label = 'Thrall';
  const m = Array.isArray(a.mesh.material) ? a.mesh.material[0] : a.mesh.material;
  if (m instanceof THREE.MeshStandardMaterial) m.color.multiply(MOSS);
}

interface Fallen { group: THREE.Group; flame: { mesh: THREE.Mesh; mat: FxMaterial }; ring: GroundTell; x: number; z: number; y: number; from: THREE.Vector3; fallT: number; acc: number }
interface Thrall { a: Animal; lane: LaneCharge; mode: 'approach' | 'charge' }

/** a number some other system rewrites every frame (or never): scaled on top of whatever it holds this frame */
class Dim {
  private base = 0; private last = Number.NaN;
  apply(cur: number, k: number): number { if (cur !== this.last) this.base = cur; const v = this.base * k; this.last = v; return v; }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _col = new THREE.Color();

export class AntlerKingFight implements BossScript {
  king: Animal | null = null;
  look: KingLook | null = null;
  phase = 0;
  mode = 'dormant';
  private modeT = 0;
  private invuln = false; private lockHp = 0;
  private sweepCd = 2; private stompCd = 4; private callCd = 0; private laneN = 0;
  private readonly kit: KingKit;
  private readonly tellRing: GroundTell;
  private readonly waves: { g: GroundTell; r: number; on: boolean; hit: boolean; delay: number }[];
  private readonly lane: LaneCharge;
  private readonly fallen: Fallen[] = [];
  private thralls: Thrall[] = [];
  private readonly thrallLanes: LaneCharge[];
  private readonly wall: FogWall;
  private readonly puffs: Puffs;
  private light: THREE.PointLight | null = null;
  private sealK = 0; private sealed = false;
  private darkK = 0; private glow = 0; private open = 0;
  private present = false;
  private won = false;
  // the dimmers (the sky rewrites these every frame; the fight scales them after it)
  private readonly dimFog = new Dim(); private readonly dimHemi = new Dim(); private readonly dimEnv = new Dim();
  private readonly dimLights: Dim[] = [];
  private readonly dimDome = [new Dim(), new Dim()];
  private fogCol = new THREE.Color(); private fogLast = new THREE.Color(-1, -1, -1);
  /** thralls parked at boot so their programs compile with the rest (never shown) */
  private readonly parked: Animal[] = [];

  constructor(private readonly ctx: PineCtx) {
    const scene = ctx.game.scene;
    this.kit = makeKingKit(ctx.sky);
    this.tellRing = new GroundTell(scene, 'ring', AMBER_TELL);
    this.waves = [0, 1].map(() => ({ g: new GroundTell(scene, 'ring', EMBER), r: 0, on: false, hit: false, delay: 0 }));
    this.lane = new LaneCharge(scene, AMBER_TELL, { width: 4.2, speed: 13, overshoot: 10, dmg: 32, skid: 1.6, reach: 1.9 });
    this.thrallLanes = [0, 1, 2].map(() => new LaneCharge(scene, EMBER, { width: 2.4, speed: 9, overshoot: 5, dmg: 14, skid: 1.2, reach: 1.7 }));
    this.wall = new FogWall(scene, C.x, heightAt(C.x, C.z) - 2.5, C.z, FOG_R, 22);
    this.puffs = new Puffs(scene, new THREE.Color(2.0, 1.1, 0.4), 3);
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group(); group.visible = false; scene.add(group);
      const flame = flameCard(EMBER, 1.3, 1.9); scene.add(flame.mesh);
      this.fallen.push({ group, flame, ring: new GroundTell(scene, 'ring', EMBER), x: 0, z: 0, y: 0, from: new THREE.Vector3(), fallT: -1, acc: 0 });
    }
    // the fight's one light: taken from the scene's LightPool at boot (a constant light count — no recompile), dark
    // until the fight; released between fights so an elite's orb can borrow it
    this.light = LightPool.for(scene).acquire(0xffa040, 0, 18, 1.6);
    registerKing();
    kingDamage = (a, p) => this.damageMul(a, p);
    for (const f of this.fallen) f.group.add(this.kitLantern());
    // the sky rewrites the fog / lights every frame AFTER the updaters (Game.loop: updaters → sky.update → render), so the
    // fight's thick air is laid on at the scene's render, on top of this frame's sky
    const prev = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args) => { this.atmosphere(); prev(...args); };
  }

  /** boot: the King and a thrall of each kind made now (their models + programs compile with the rest), parked */
  prewarm(): void {
    const k = this.spawnKing();
    // desktop's fur shells (tier furShells): made now on the parked King so their 8 programs compile at boot, not when
    // he (or the first animal) first comes within shell range mid-fight; they stay parked, hidden, with him
    if (TIER_CONFIG.furShells) { k.setShellLevel(8); k.setShellLevel(0); }
    this.present = true; this.setPresent(false);
    for (const kind of ['elk', 'boar'] as const) {
      const v = thrallVariant(kind);
      try {
        const a = this.ctx.animals.spawn(kind, C.x, C.z, 0, v.variant);
        if (v.tinted) tintThrall(a);
        this.park(a); this.parked.push(a);
      } catch (e) { console.warn('[antler-king] a thrall did not build', e); }
    }
  }

  private kitLantern(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.kit.frameGeo, this.kit.frameMat), new THREE.Mesh(this.kit.glassGeo, this.kit.glassMat));
    g.scale.setScalar(KING_VARIANT.scale[0]);
    return g;
  }

  /** out of every list (AI, minimap, aim, hitboxes), hidden, but still in the scene */
  private park(a: Animal): void {
    a.hidden = true; a.mesh.visible = false;
    const i = this.ctx.animals.animals.indexOf(a); if (i !== -1) this.ctx.animals.animals.splice(i, 1);
  }
  private unpark(a: Animal): void {
    a.hidden = false; a.mesh.visible = true;
    if (!this.ctx.animals.animals.includes(a)) this.ctx.animals.animals.push(a);
  }

  private spawnKing(): Animal {
    const old = this.king;
    if (old) { this.look?.dispose(); retire(this.ctx.animals, old); }
    const a = this.ctx.animals.spawn(KING_KIND, C.x, C.z, 0, 'warden');
    a.herd = -1;
    this.king = a;
    this.look = dressAntlerKing(a, this.kit);
    // bark, not blood: splinters and embers where a bolt lands
    const prev = a.onDamaged;
    a.onDamaged = (an, amount, point, dir, died) => {
      prev?.(an, amount, point, dir, died);
      _w.copy(dir).negate();
      Impacts.for(this.ctx.game).burst('wood', point, _w, 8);
      if (this.onRibs(point)) Impacts.for(this.ctx.game).burst('sparks', point, _w, this.open > 0.5 ? 14 : 5);
    };
    return a;
  }

  private onRibs(p: THREE.Vector3): boolean { const l = this.look; return l !== null && p.distanceTo(l.ribcageWorld(_v)) < l.ribcageRadius; }

  private damageMul(a: Animal, p: THREE.Vector3): number {
    if (a !== this.king) return 1;
    if (this.invuln || this.mode === 'dormant') return 0.01;
    if (this.onRibs(p)) return this.open > 0.5 ? 3 : 0.6;
    return 0.25;
  }

  // ── BossScript ──
  get hpFrac(): number { const k = this.king; return k ? Math.max(0, k.hp / k.maxHp) : 0; }
  get shielded(): boolean { return this.invuln; }
  get dead(): boolean { return this.king !== null && !this.king.alive; }
  inArena(p: THREE.Vector3): boolean { return this.present && Math.hypot(p.x - C.x, p.z - C.z) < ARENA_IN; }
  seal(on: boolean): void { this.sealed = on; }
  clampHp(frac: number): void { const k = this.king; if (k) { k.hp = Math.max(1, Math.round(k.maxHp * frac)); this.lockHp = k.hp; } }
  setInvulnerable(on: boolean): void { this.invuln = on; if (on && this.king) this.lockHp = this.king.hp; }
  rewardPoint(): THREE.Vector3 { return new THREE.Vector3(C.x, heightAt(C.x, C.z + 4) + 0.2, C.z + 4); }
  respawnPoint(): { pos: THREE.Vector3; yaw: number } { return { pos: new THREE.Vector3(C.x, heightAt(C.x, C.z + 26), C.z + 26), yaw: 0 }; }

  /** in the world tonight (true) or not at all */
  setPresent(on: boolean): void {
    if (on === this.present) return;
    this.present = on;
    const k = this.king;
    if (on) { if (k === null || !k.alive) this.spawnKing(); else this.unpark(k); }
    else {
      if (k) { if (k.alive) this.park(k); else { this.look?.dispose(); retire(this.ctx.animals, k); this.king = null; this.look = null; } }
      this.clearAdds(); this.hideTells(); this.setHazards(false);
      this.sealed = false; this.mode = 'dormant';
      if (this.light) { LightPool.for(this.ctx.game.scene).release(this.light); this.light = null; }
    }
  }

  reset(phase: number): void {
    this.phase = phase; this.won = false;
    if (!this.present) this.setPresent(true);
    let k = this.king;
    if (k === null || !k.alive) k = this.spawnKing();
    k.place(C.x, C.z, 0);
    k.hp = Math.max(1, Math.round(k.maxHp * (KING_PHASE_AT[phase] ?? 1)));
    k.setMotion(0, 0, 1); k.lookWeight = 0; k.cancelAttack();
    this.clearAdds(); this.hideTells();
    this.look?.setLanternsHung(phase < 1);
    this.setHazards(phase >= 1);
    this.glow = 0.15; this.look?.setGlow(this.glow); this.open = 0;
    this.darkK = 0;
    this.mode = 'dormant';
    this.sweepCd = 2; this.stompCd = 3; this.callCd = 0;
  }

  intro(t: number, short: boolean): THREE.Vector3 {
    const k = this.king, look = this.look;
    if (!k || !look) return _v.set(C.x, heightAt(C.x, C.z) + 4, C.z);
    const len = short ? 1.4 : 4.2;
    if (this.mode !== 'intro') { this.mode = 'intro'; this.modeT = 0; this.ctx.shot('king_bells', k.position); }
    this.modeT = t;
    this.glow = Math.max(0.15, THREE.MathUtils.smoothstep(t, 0.2, len * 0.75));
    look.setGlow(this.glow);
    k.lookTarget.copy(this.ctx.player.position); k.lookWeight = Math.min(1, t / (len * 0.5));
    if (t > len * 0.6 && t - 1 / 30 <= len * 0.6) { this.ctx.shot('king_roar', k.position); voice(this.ctx.animals, 'bear_roar', k.position); }
    this.acquireLight();
    return look.ribcageWorld(_v);
  }

  begin(phase: number): void {
    this.phase = phase; this.glow = 1; this.look?.setGlow(1);
    this.setMode(phase === 2 ? 'stalk3' : 'stalk');
    this.acquireLight();
    if (phase >= 1 && this.thralls.length === 0) this.callCd = 1.5;
  }

  enterPhase(phase: number): void {
    this.phase = phase;
    this.hideTells(); this.lane.cancel();
    if (phase === 1) { this.dropLanterns(); this.callCd = 1.2; this.setMode('stalk'); }
    if (phase === 2) { this.setMode('stalk3'); this.laneN = 0; this.ctx.shot('king_roar', this.king?.position ?? _v.set(C.x, 0, C.z)); }
  }

  victory(): void {
    this.won = true; this.mode = 'dead';
    this.hideTells(); this.lane.cancel();
    for (const th of this.thralls) { if (th.a.alive) { this.puffs.burst(_v.copy(th.a.position).setY(th.a.position.y + 1), 0.5, 2.5, 0.6, 0.7); retire(this.ctx.animals, th.a); } th.lane.cancel(); }
    this.thralls = [];
    this.setHazards(false);
    this.glow = 0.25; this.look?.setGlow(this.glow); this.look?.setOpen(0, 0);
    if (this.light) { LightPool.for(this.ctx.game.scene).release(this.light); this.light = null; }
  }

  update(dt: number, t: number, fighting: boolean): void {
    const k = this.king, look = this.look;
    // the seal: the fog wall + the thick air come in over ~2 s, and go the same way
    this.sealK = THREE.MathUtils.clamp(this.sealK + (this.sealed ? dt / 2 : -dt / 2.5), 0, 1);
    this.wall.alpha = 0.92 * this.sealK;
    this.darkK = THREE.MathUtils.clamp(this.darkK + ((this.phase === 2 && !this.won && this.sealed) ? dt / 2.5 : -dt / 2), 0, 1);
    this.wall.update(t, this.ctx.game.scene.fog instanceof THREE.Fog ? this.ctx.game.scene.fog.color : null);
    this.puffs.update(dt, t);
    this.hazards(dt, t, fighting);
    if (!k || !look) return;
    if (this.invuln && k.hp < this.lockHp) k.hp = this.lockHp;
    if (this.sealed) this.softWall();
    look.setOpen(Math.max(this.open, 0.35 * this.darkK), t);
    this.updateLight();
    if (!fighting || !k.alive) { this.open = Math.max(0, this.open - dt * 2); return; }
    this.modeT += dt;
    this.fight(k, dt, t);
    this.tickThralls(dt, t);
    // he never leaves the stones
    const kd = Math.hypot(k.position.x - C.x, k.position.z - C.z);
    if (kd > KING_R) {
      k.position.x = C.x + (k.position.x - C.x) / kd * KING_R; k.position.z = C.z + (k.position.z - C.z) / kd * KING_R;
      if (this.lane.state === 'run') { this.lane.state = 'skid'; this.lane.t = 0; }
    }
  }

  private setMode(m: string): void { this.mode = m; this.modeT = 0; }

  private fight(k: Animal, dt: number, t: number): void {
    const p = this.ctx.player.position;
    const d = Math.hypot(p.x - k.position.x, p.z - k.position.z), yaw = headingTo(k.position.x, k.position.z, p.x, p.z);
    this.sweepCd -= dt; this.stompCd -= dt; this.callCd -= dt;
    this.tellRing.setTime(t);
    k.lookTarget.copy(p); k.lookWeight = 1;
    const wantOpen = this.mode === 'open' || (this.mode === 'stalk3' && this.lane.state === 'skid') ? 1 : 0;
    this.open = THREE.MathUtils.clamp(this.open + (wantOpen > this.open ? dt * 4 : -dt * 2.5), 0, 1);
    this.tickWaves(k, dt, t);
    switch (this.mode) {
      case 'stalk': {
        k.setMotion(yaw, d > 9 ? (this.phase === 1 ? 2.8 : 2.3) : 0, 1.4);
        if (this.phase >= 1 && this.callCd <= 0 && this.aliveThralls() < 3) { this.setMode('call'); k.startAttack(1.6); this.ctx.shot('king_bells', k.position); break; }
        if (d < 10 && this.sweepCd <= 0) { this.setMode('sweep'); k.startAttack(0.9); break; }
        if (this.stompCd <= 0 && this.modeT > 1) { this.setMode('stomp'); k.startAttack(1.0); }
        break;
      }
      case 'sweep': {
        k.setMotion(yaw, 0, 1.2);
        const kk = Math.min(1, this.modeT / 0.9);
        this.tellRing.ring(k.position.x, k.position.z, 9.5, 0.3 + 0.6 * kk * (0.75 + 0.25 * Math.sin(t * 24)));
        if (this.modeT >= 0.9) {
          this.tellRing.hide();
          if (inArc(k.position.x, k.position.z, k.yaw, p.x, p.z, 1.4, 10)) { this.ctx.hurt(k, 24); this.ctx.trauma(0.45); }
          this.ctx.trauma(0.15);
          this.sweepCd = 5; this.setMode('stalk');
        }
        break;
      }
      case 'stomp': {
        k.setMotion(yaw, 0, 1.2);
        const kk = Math.min(1, this.modeT / 1.0);
        this.tellRing.ring(k.position.x, k.position.z, 3.5 + kk, 0.4 + 0.5 * kk * (0.7 + 0.3 * Math.sin(t * 26)));
        if (this.modeT >= 1.0) { this.tellRing.hide(); this.stompNow(k); this.setMode('waves'); }
        break;
      }
      case 'waves': {
        k.setMotion(yaw, 0, 1);
        if (this.waves.every((w) => !w.on)) { this.setMode('open'); this.ctx.shot('king_roar', k.position); }
        break;
      }
      case 'open': {
        k.setMotion(yaw, 0, 0.8);
        if (this.modeT >= (this.phase === 1 ? 2.6 : 3.2)) { this.stompCd = this.phase === 1 ? 7.5 : 9; this.setMode(this.phase === 2 ? 'stalk3' : 'stalk'); }
        break;
      }
      case 'call': {
        k.setMotion(yaw, 0, 1);
        if (this.modeT >= 1.6) { this.callThralls(2); this.callCd = 20; this.setMode('stalk'); }
        break;
      }
      case 'stalk3': {
        // the Last Light: hold off, then down a lane at you — two or three in a row, the ribcage flaring at every skid
        if (this.lane.busy) {
          this.lane.update(k, dt, t, p, (dmg) => { this.ctx.hurt(k, dmg); this.ctx.trauma(0.6); });
          if (this.lane.state === 'run' && this.lane.t < dt * 1.5) this.ctx.shot('king_stomp', k.position);
          if (this.lane.idle()) { this.laneN++; this.modeT = this.laneN % 3 === 0 ? -1.5 : 0.4; }
          break;
        }
        k.setMotion(yaw, d > 18 ? 2.4 : 0, 1.6);
        if (this.stompCd <= 0 && d < 14) { this.setMode('stomp'); k.startAttack(1.0); break; }
        if (this.modeT > 1.2) { this.lane.start(k, p.x, p.z, 1.1); voice(this.ctx.animals, 'bear_roar', k.position); }
        break;
      }
      default: this.setMode(this.phase === 2 ? 'stalk3' : 'stalk');
    }
  }

  /** the stomp lands: dust, a shake, the root ring(s) race out */
  private stompNow(k: Animal): void {
    _v.set(k.position.x, k.position.y + 0.3, k.position.z);
    Impacts.for(this.ctx.game).burst('dirt', _v, _w.set(0, 1, 0), 24);
    this.ctx.shot('king_stomp', k.position);
    this.ctx.trauma(0.3);
    const n = this.phase >= 1 ? 2 : 1;
    this.waves.forEach((w, i) => { w.on = i < n; w.r = 3.5; w.hit = false; w.delay = i * 0.8; });
  }
  private tickWaves(k: Animal, dt: number, t: number): void {
    const p = this.ctx.player.position;
    const pd = Math.hypot(p.x - C.x, p.z - C.z) < FOG_R ? Math.hypot(p.x - k.position.x, p.z - k.position.z) : Infinity;
    for (const w of this.waves) {
      if (!w.on) { w.g.hide(); continue; }
      if (w.delay > 0) { w.delay -= dt; continue; }
      w.r += dt * 10.5;
      w.g.setTime(t);
      w.g.ring(k.position.x, k.position.z, w.r, 0.95, 0.25);
      if (!w.hit && ringCatches(pd, w.r, 0.9, !this.ctx.player.onGround)) { w.hit = true; this.ctx.hurt(k, 20); this.ctx.trauma(0.4); }
      if (w.r > FOG_R) { w.on = false; w.g.hide(); }
    }
  }

  // ── thralls ──
  private aliveThralls(): number { return this.thralls.filter((th) => th.a.alive).length; }
  private callThralls(n: number): void {
    const p = this.ctx.player.position;
    for (let i = 0; i < n; i++) {
      const lane = this.thrallLanes.find((l) => !this.thralls.some((th) => th.lane === l && th.a.alive));
      if (!lane) break;
      const ang = Math.random() * Math.PI * 2, x = C.x + Math.sin(ang) * 27, z = C.z + Math.cos(ang) * 27;
      const kind = i % 2 === 0 ? 'elk' : 'boar';
      const v = thrallVariant(kind);
      const a = this.ctx.animals.spawn(kind, x, z, headingTo(x, z, p.x, p.z), v.variant);
      if (v.tinted) tintThrall(a);
      own(a);
      this.thralls = this.thralls.filter((th) => th.lane !== lane);
      this.thralls.push({ a, lane, mode: 'approach' });
      this.puffs.burst(_v.set(x, heightAt(x, z) + 1, z), 2.5, 0.6, 0.6, 0.6);
      this.ctx.shot('thrall_call', a.position);
    }
  }
  private tickThralls(dt: number, t: number): void {
    const p = this.ctx.player.position;
    for (const th of this.thralls) {
      const a = th.a;
      if (!a.alive) { th.lane.cancel(); continue; }
      a.lookTarget.copy(p); a.lookWeight = 1;
      if (th.mode === 'charge') { th.lane.update(a, dt, t, p, (dmg) => { this.ctx.hurt(a, dmg); this.ctx.trauma(0.3); }); if (!th.lane.busy) th.mode = 'approach'; }
      else {
        const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
        a.setMotion(headingTo(a.position.x, a.position.z, p.x, p.z), d > 8 ? 4.8 : d > 4.5 ? 0.8 : 0, 2.5);
        if (d < 11 && Math.random() < dt * 0.9) { th.lane.start(a, p.x, p.z, 0.7); th.mode = 'charge'; this.ctx.shot('thrall_groan', a.position); }
      }
      const ad = Math.hypot(a.position.x - C.x, a.position.z - C.z);
      if (ad > WALL_R + 1) { a.position.x = C.x + (a.position.x - C.x) / ad * (WALL_R + 1); a.position.z = C.z + (a.position.z - C.z) / ad * (WALL_R + 1); }
    }
  }
  private clearAdds(): void {
    for (const th of this.thralls) { th.lane.cancel(); retire(this.ctx.animals, th.a); }
    this.thralls = [];
  }

  // ── the lanterns fall ──
  private dropLanterns(): void {
    const k = this.king, look = this.look;
    if (!k || !look) return;
    this.fallen.forEach((f, i) => {
      look.lanternWorld(i, f.from);
      const ang = k.yaw + (i - 1) * 2.1 + 0.35, r = 10 + i * 2.5;
      f.x = C.x + Math.sin(ang) * r; f.z = C.z + Math.cos(ang) * r; f.y = heightAt(f.x, f.z);
      f.fallT = 0; f.acc = 0;
      f.group.visible = true; f.group.position.copy(f.from);
    });
    look.setLanternsHung(false);
  }
  /** on (placed where they burn, no fall — a checkpoint at phase II / III) or all out */
  private setHazards(on: boolean): void {
    this.fallen.forEach((f, i) => {
      if (on) {
        const ang = (i - 1) * 2.1 + 0.35, r = 10 + i * 2.5;
        f.x = C.x + Math.sin(ang) * r; f.z = C.z + Math.cos(ang) * r; f.y = heightAt(f.x, f.z);
        f.fallT = 1; f.group.visible = true; f.group.position.set(f.x, f.y + 0.3, f.z); f.group.rotation.set(1.3, i, 0.4);
      } else { f.fallT = -1; f.group.visible = false; f.flame.mesh.visible = false; f.ring.hide(); }
    });
  }
  private hazards(dt: number, t: number, fighting: boolean): void {
    const p = this.ctx.player.position;
    for (const f of this.fallen) {
      if (f.fallT < 0) continue;
      if (f.fallT < 1) {
        f.fallT = Math.min(1, f.fallT + dt / 0.75);
        const u = f.fallT;
        f.group.position.set(f.from.x + (f.x - f.from.x) * u, f.from.y + (f.y + 0.3 - f.from.y) * u * u + Math.sin(u * Math.PI) * 2, f.from.z + (f.z - f.from.z) * u);
        f.group.rotation.set(u * 1.3, u * 2, u * 0.4);
        if (f.fallT >= 1) { this.ctx.shot('lanternLight', _v.set(f.x, f.y, f.z)); Impacts.for(this.ctx.game).burst('sparks', _v.set(f.x, f.y + 0.3, f.z), _w.set(0, 1, 0), 16); }
        continue;
      }
      const ember = this.darkK > 0 ? 1 - 0.5 * this.darkK : 1;
      f.flame.mesh.visible = true; f.flame.mesh.position.set(f.x, f.y, f.z);
      f.flame.mat.uniforms.uAlpha.value = 0.95 * ember; f.flame.mat.uniforms.uTime.value = t;
      f.ring.setTime(t);
      f.ring.ring(f.x, f.z, 3.2, (0.35 + 0.15 * Math.sin(t * 5 + f.x)) * ember, 0.2);
      if (fighting && !this.won) {
        const inside = Math.hypot(p.x - f.x, p.z - f.z) < 3.0;
        const r = burnTick(f.acc, dt, inside, 0.8);
        f.acc = r.acc;
        const k = this.king;
        if (r.bites > 0 && k) { this.ctx.hurt(k, 9 * r.bites); }
      }
    }
  }

  // ── the room ──
  private hideTells(): void { this.tellRing.hide(); for (const w of this.waves) { w.on = false; w.g.hide(); } this.lane.cancel(); }

  /** the soft wall: past WALL_R you are shoved back in; never out past the fog */
  private softWall(): void {
    const pl = this.ctx.player, p = pl.position;
    const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz);
    const push = wallPush(d, WALL_R);
    if (push > 0 && d > 1e-3) pl.shove(C.x + dx / d * (d + 2), C.z + dz / d * (d + 2), push);
    if (d > FOG_R - 1) { p.x = C.x + dx / d * (FOG_R - 1.2); p.z = C.z + dz / d * (FOG_R - 1.2); }
  }

  /** the fog closing (the seal) and the Last Light's dark, scaled on top of what the sky set this frame */
  private atmosphere(): void {
    const seal = this.sealK, dark = this.darkK;
    if (seal <= 0 && dark <= 0 && this.fogLast.r < 0) return;
    const sky = this.ctx.sky, scene = this.ctx.game.scene;
    // density: × 26 in the fight, × 76 in the dark (the night preset’s 0.0007 → ~0.018 / ~0.05)
    fogUniforms.fogDistDensity.value = this.dimFog.apply(fogUniforms.fogDistDensity.value, 1 + 25 * seal + 50 * dark);
    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      if (!fog.color.equals(this.fogLast)) this.fogCol.copy(fog.color);
      fog.color.copy(_col.copy(this.fogCol).multiplyScalar(1 - 0.35 * seal - 0.55 * dark));
      this.fogLast.copy(fog.color);
      if (seal <= 0 && dark <= 0) { fog.color.copy(this.fogCol); this.fogLast.setRGB(-1, -1, -1); }
    }
    const lk = 1 - 0.8 * dark;
    sky.hemi.intensity = this.dimHemi.apply(sky.hemi.intensity, lk);
    scene.environmentIntensity = this.dimEnv.apply(scene.environmentIntensity, 1 - 0.75 * dark);
    const dome = sky.pine?.dome.material;
    if (dome instanceof THREE.ShaderMaterial) {
      const ga = dome.uniforms['uGainA'], gb = dome.uniforms['uGainB'], dk = 1 - 0.85 * dark;
      if (ga && typeof ga.value === 'number') ga.value = this.dimDome[0]?.apply(ga.value, dk) ?? ga.value;
      if (gb && typeof gb.value === 'number') gb.value = this.dimDome[1]?.apply(gb.value, dk) ?? gb.value;
    }
    sky.csm.lights.forEach((l, i) => {
      let dim = this.dimLights[i];
      if (dim === undefined) { dim = new Dim(); this.dimLights[i] = dim; }
      l.intensity = dim.apply(l.intensity, 1 - 0.85 * dark);
    });
  }

  private acquireLight(): void { this.light ??= LightPool.for(this.ctx.game.scene).acquire(0xffa040, 0, 18, 1.6); }
  /** I–II: the ribcage's amber on the stones; III: your lantern */
  private updateLight(): void {
    const l = this.light, look = this.look;
    if (!l || !look) return;
    if (this.darkK > 0.5) {
      const c = this.ctx.game.camera.position;
      l.position.set(c.x, c.y + 0.3, c.z); l.color.setRGB(1, 0.72, 0.4); l.distance = 16; l.intensity = 16 * this.darkK;
    } else {
      look.ribcageWorld(l.position); l.position.y += 0.5; l.color.setRGB(1, 0.55, 0.18); l.distance = 20;
      l.intensity = this.won ? 0 : 30 * this.glow * (0.6 + 0.8 * this.open);
    }
  }
}

// ─────────────────────────────── the wiring ───────────────────────────────

export interface AntlerKingHost {
  ctx: PineCtx;
  interactables: Interactable[];
  params: URLSearchParams;
  music: Music;
  refill: () => void;
  setWeaponsEnabled: (on: boolean) => void;
  pickupHum: (on: boolean) => void;
}

export class AntlerKing {
  readonly fight: AntlerKingFight;
  readonly boss: Boss;
  readonly ui = new BossBar();
  private forcedNight = false;
  private touchSkip = false;

  constructor(private readonly host: AntlerKingHost) {
    const { ctx } = host;
    this.fight = new AntlerKingFight(ctx);
    this.fight.prewarm();
    const def: BossDef = {
      id: KING_KIND, name: 'THE ANTLER KING', title: 'WARDEN OF PINE HOLLOW', retryTitle: 'THE WARDEN STANDS',
      phases: PHASES, intro: 4.2, introShort: 1.4,
      reward: {
        tier: 'LEGENDARY', name: "THE WARDEN'S LONGBOW", flavour: 'his bow, and his amber for your crossbow', prompt: "Take the Warden's Longbow",
        model: () => ctx.longbow?.model() ?? ctx.skinModel('warden'),
        grant: () => { ctx.addItem('warden-longbow'); ctx.ownSkin('warden'); ctx.longbow?.grant(); },
        trophy: () => { ctx.addItem('amber-heartwood'); },
      },
    };
    const pl = ctx.player;
    this.boss = new Boss(def, this.fight, {
      scene: ctx.game.scene, player: pl, camera: ctx.game.camera, renderer: ctx.game.renderer,
      lockInput: (on) => { pl.carried = on; host.setWeaponsEnabled(!on); },
      respawn: (pos, yaw) => { pl.spawn(pos.x, pos.z, yaw); pl.pitch = 0; host.refill(); },
      addInteractable: (it) => { host.interactables.push(it); },
      removeInteractable: (it) => { const i = host.interactables.indexOf(it); if (i !== -1) host.interactables.splice(i, 1); },
      skipHeld: () => this.touchSkip || pl.keys.has('Space') || pl.keys.has('KeyE') || pl.keys.has('Enter'),
      toast: ctx.toast, feed: ctx.feed, pickupHum: host.pickupHum,
      music: (e) => this.music(e),
    }, this.ui, 'pine-hollow');
    window.addEventListener('pointerdown', () => { this.touchSkip = true; });
    window.addEventListener('pointerup', () => { this.touchSkip = false; });
    window.addEventListener('pointercancel', () => { this.touchSkip = false; });
    // dev: `?boss=antler-king` — night, you at the stones' N gap; `&bossPhase=2|3` at that checkpoint
    if (host.params.get('boss') === KING_KIND) {
      this.forcedNight = true;
      void ctx.sky.pine?.setPhase(PINE_PHASES.night);
      const from = Number(host.params.get('from') ?? '26');
      pl.spawn(C.x, C.z + (Number.isFinite(from) ? from : 26), 0);
      this.fight.setPresent(true); this.boss.arm();
      const ph = Number(host.params.get('bossPhase') ?? '1');
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
  }

  private music(e: 'intro' | 'phase' | 'victory' | 'death' | 'pickup'): void {
    const m = this.host.music;
    if (e === 'intro') { m.setPineScene('boss'); m.setBossPhase(1); m.combat(1); }
    else if (e === 'phase') { const ph = this.fight.phase + 1; m.setBossPhase(ph === 3 ? 3 : ph === 2 ? 2 : 1); }
    else if (e === 'victory') { m.setPineScene(this.night() ? 'night' : 'day'); m.sting('chunk'); }
    else if (e === 'death') { m.setPineScene(this.night() ? 'night' : 'day'); m.sting('death'); }
    else m.sting('pickup');
  }

  private night(): boolean { return this.forcedNight || this.host.ctx.night() > 0.5; }

  /** every frame: the King comes at night when you are near, goes by day / when you are far; the fight runs */
  update(dt: number, t: number): void {
    const p = this.host.ctx.player.position, d = Math.hypot(p.x - C.x, p.z - C.z);
    const s: BossState = this.boss.state;
    const night = this.night();
    if (s === 'dormant') { if (night && d < 80) { this.fight.setPresent(true); this.boss.arm(); } }
    else if ((s === 'armed' || s === 'victory') && (d > 110 || !night)) { this.boss.disarm(); this.fight.setPresent(false); }
    this.boss.update(dt, t);
    if (this.boss.state === 'dormant') this.fight.update(dt, t, false); // Boss.update ticks the script in every other state
  }

  onPlayerDeath(): boolean { return this.boss.onPlayerDeath(); }
}

// E155 (src/core/shardState.ts): the running Pine Hollow's fight (a rebuilt one hooks in again)
shardSlot('antlerKing.damage', () => kingDamage, (v) => { kingDamage = v; });
