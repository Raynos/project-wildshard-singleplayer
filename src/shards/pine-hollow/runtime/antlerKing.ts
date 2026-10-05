import { pineScore } from '../runtime/audio/score';
import { installEnteredKingBindings } from './kingLifetime';
import { AntlerKingGoals } from './KingGoals';
import { pineBackdrop } from '../look/skyBackdrop';
import { PINE_LANES, PINE_STRIKES, pineContact } from '../combat/strikes';
import type { Spawner } from '@wildshard/engine/ai/encounters';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { app } from '@wildshard/engine/app/runtime';
import type { Music } from '@wildshard/engine/audio/Music';
import type { DamageDealt } from '@wildshard/engine/combat/pipeline';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { registerSpecies, speciesDef, variantDef, hasSpecies, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import type { FxMaterial } from '@wildshard/engine/fx/groundFx';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { thrallSpawner, spawnThrallFrom } from '../combat/spawns';
import * as THREE from 'three';
import type { BossScript, BossState } from '@wildshard/engine/ai/BossBrain';
import { Boss, type BossDef } from '@wildshard/game/Boss';
import { GroundTell } from '@wildshard/game/Elite';
import { PINE_PHASES } from '../look/dayKeys';
import { KINGS_CLEARING } from '../layout';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { FogWall, Puffs, flameCard } from '../combat/fxKit';
import { KING_VARIANT, dressAntlerKing, makeKingKit, kingOwnSpecies, type KingKit, type KingLook } from '../models/antlerKing';
import { ACT_BRACE, ACT_ROAR, ACT_STRIKE, ACT_SWEEP } from '../combat/kingRig';
import { own, retire, voice, LaneCharge, type PineCtx } from '../combat/ctx';
import { KING_PHASE_AT, burnTick, headingTo, wallPush } from '../combat/combatMath';
import { ANTLER_KING_ENCOUNTER } from '../data/antlerKing';

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
 *   I · THE WARDEN (100 → 60 %): he walks you down. ANTLER SWEEP up close (a ring paints round him at the rack's reach,
 *     0.9 s; he dives and the rack scythes through you → 24 in front of him). ROOT-RING STOMP (the paw wind-up, 1.0 s) → a ring of roots races out across the whole clearing — JUMP it
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
 *   src/engine/player/Longbow.ts, adapted from Nalati's Bow.ts) joins the kit, with the WARDEN crossbow skin and the
 *   Owned 'warden-longbow' that keeps it across sessions (E314 C, src/shards/pine-hollow/loadout/loadout.ts); a re-fight pays 3 amber resin. Music: Music.ts's Pine Hollow boss slot (setPineScene('boss') / setBossPhase).
 *
 *   STAND-IN MODEL: src/shards/pine-hollow/models/antlerKing.ts (the elk rig ×2.6, bark coat, lanterns, ribcage, skull) — `dressAntlerKing` is the one
 *   factory PH-M3's Bark Warden replaces. The King is its own kind, 'antler-king' (the journal's page answers to it).
 *   HIS OWN RIG (E322 F-M1, Jake picked B; the elk-rig King went): the species as a custom rig (kingOwnSpecies, kingRig.ts) —
 *   each move names itself in `mem.act` before its wind-up: the sweep → the antler sweep, the stomp → the rearing strike
 *   (up on the hind legs, the slam at the wind-up's end, when the root ring goes out), the bells → the roar (reared, no
 *   slam), a lane's tell → the brace; the lane itself → the charge gallop (his speed), a bolt → the hit recoil.
 *
 * Dev: `?boss=antler-king` (night forced, you at the N gap, 26 m out; `&from=<m>`), `&bossPhase=2|3` (that checkpoint),
 * `&bossGod=1` (nothing hurts you). `window.__antlerKing`.
 */

export const KING_KIND = 'antler-king';
const C = KINGS_CLEARING;
const ARENA_IN = 22, WALL_R = 27.5, FOG_R = 31, KING_R = 24;
/**
 * His reach, measured on his own hull (E350 F-X2: scripts/e350-king-measure.mjs poses kingRig.ts's clips on the GLB; world
 * m from his origin, the point between his hooves). The fight was tuned on the elk-rig King (a 10 m sweep, a 3.5 m stomp, a
 * 4.2 m lane); these put every hit where his body visibly is. Timings and damage are unchanged. The player is 0.38 m wide.
 */
/** the sweep: he dives and scythes the rack through a standing player's height (kingRig.ts clipSweep). His mesh touches a
 *  standing player (scripts/e350-king-measure.mjs --sweepmap: the skinned hull over the swing, both tiers) everywhere
 *  within 4 m and ±75° of his heading (his forelegs, chest and face come down on you), and out to 7.1 m from 45° to his
 *  right to 15° to his left (the rack's scythe): the blow is those two regions (7 % of the map's cells disagree, all on
 *  their edges; the old single arc disagreed on 19 %). The ring tells the scythe's reach; he stops walking in at 0.9 of it
 *  (the old 9 of 10 m) */

/** the rearing strike's slam: the forehooves land 4.0 m ahead, ±1.7 m off his line (4.4 m out): the root ring bursts from there */
const STOMP_R = 4.4;
/** the lane charge: galloping past, his mesh touches a standing player up to 3.0 m off his line (his forelegs and the
 *  shoulders over them; --lanemap, every gait phase), so the lane is 5.2 m wide (LaneCharge catches you within half of it
 *  + 0.4 = 3.0 m; the elk-rig King's caught at 2.5); the contact reach 2.0 × his 2.6 scale = 5.2 m, his front (4.8 m) + the
 *  player */
const AMBER_TELL = new THREE.Color(1.5, 0.62, 0.12), EMBER = new THREE.Color(2.6, 1.1, 0.3);

let kingDamage: ((a: Animal, p: THREE.Vector3) => number) | null = null;

/** the King's species: the elk's fields re-registered as 'antler-king' — its own AI (the fight drives it), no blood (bark) —
 *  on his own upright rig (E322 F-M1, kingOwnSpecies) */
export function registerKing(): void {
  if (hasSpecies(KING_KIND)) return;
  const elk = speciesDef('elk');
  const def: SpeciesDef = {
    ...elk, kind: KING_KIND, label: 'The Antler King', variants: [KING_VARIANT], aggressive: true, blood: false,
    walkSpeed: 2.2, chargeSpeed: 13,
    sounds: { call: 'elk_bugle', hurt: 'bear_hurt', callEvery: [600, 900] },
    eyeGlow: [1.0, 0.55, 0.15], eyeGlowIntensity: 2.5,
    think: () => { /* the fight's update drives him (AntlerKingFight) */ },
    damageMul: (a, p) => kingDamage?.(a, p) ?? 1,
  };
  registerSpecies(kingOwnSpecies(def));
}

/** the move the King's rig plays for the attack about to start (kingRig.ts ACT_*) */
const act = (k: Animal, move: number): void => { k.mem['act'] = move; };

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

export class AntlerKingFight extends AntlerKingGoals implements BossScript {
  king: Animal | null = null;
  look: KingLook | null = null;
  private invuln = false; private lockHp = 0;
  private readonly kit: KingKit;
  protected override readonly tellRing: GroundTell;
  protected override readonly waves: { g: GroundTell; r: number; on: boolean; hit: boolean; delay: number }[];
  protected override readonly lane: LaneCharge;
  private readonly fallen: Fallen[] = [];
  private thralls: Thrall[] = [];
  private readonly thrallLanes: LaneCharge[];
  private readonly wall: FogWall;
  private readonly puffs: Puffs;
  private light: THREE.PointLight | null = null;
  private sealK = 0; private sealed = false;
  get weatherHold(): number { return this.sealK; }
  private darkK = 0; private glow = 0; 
  private present = false;
  private won = false;
  // the dimmers (the sky rewrites these every frame; the fight scales them after it)
  private readonly dimFog = new Dim(); private readonly dimHemi = new Dim(); private readonly dimEnv = new Dim();
  private readonly dimLights: Dim[] = [];
  private readonly dimDome = [new Dim(), new Dim()];
  private fogCol = new THREE.Color(); private fogLast = new THREE.Color(-1, -1, -1);
  /** thralls parked at boot so their programs compile with the rest (never shown) */
  private readonly parked: Animal[] = [];
  private readonly spawner: Spawner<Animal> | null;

  constructor(protected override readonly ctx: PineCtx, entered?: (install: () => () => void) => void) {
    super();
    this.spawner = thrallSpawner(ctx.animals, (kind, x, z, yaw) => {
      const v = thrallVariant(kind), actor = ctx.animals.spawn(kind, x, z, yaw, v.variant);
      if (v.tinted) tintThrall(actor);
      return actor;
    });
    const scene = ctx.game.scene;
    this.kit = makeKingKit(ctx.sky);
    this.tellRing = new GroundTell(scene, 'ring', AMBER_TELL);
    this.waves = [0, 1].map(() => ({ g: new GroundTell(scene, 'ring', EMBER), r: 0, on: false, hit: false, delay: 0 }));
    this.lane = new LaneCharge(scene, AMBER_TELL, PINE_LANES.king, this.ctx.reach);
    this.thrallLanes = [0, 1, 2].map(() => new LaneCharge(scene, EMBER, PINE_LANES.thrall, this.ctx.reach));
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
    if (entered === undefined) kingDamage = (a, p) => this.damageMul(a, p);
    for (const f of this.fallen) f.group.add(this.kitLantern());
    // the sky rewrites the fog / lights every frame AFTER the updaters (Game.loop: updaters → sky.update → render), so the
    // fight's thick air is laid on at the scene's render, on top of this frame's sky
    if (entered === undefined) {
      const prev = scene.onBeforeRender.bind(scene);
      scene.onBeforeRender = (...args) => { this.atmosphere(); prev(...args); };
    } else installEnteredKingBindings(scene, { read: () => kingDamage, write: (value) => { kingDamage = value; } },
      (a: Animal, p: THREE.Vector3) => this.damageMul(a, p), () => { this.atmosphere(); }, entered);
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
    pinBrain(a); inspectBrain(a, () => ({ state: this.mode, picks: [], brainHz: 60, pinned: true }));
    this.look = dressAntlerKing(a, this.kit);
    // bark, not blood: splinters and embers where a bolt lands
    const king = a.combatActor();
    const onDamage = ({ req }: DamageDealt): void => {
      if (req.target !== king) return;
      const { point, dir } = req;
      _w.copy(dir).negate();
      Impacts.for(this.ctx.game).burst('wood', point, _w, 8);
      if (this.onRibs(point)) Impacts.for(this.ctx.game).burst('sparks', point, _w, this.open > 0.5 ? 14 : 5);
    };
    if (this.ctx.onDamage === undefined) app.events.on('damage.dealt', onDamage, this.ctx.game.levelScope);
    else this.ctx.onDamage(onDamage);
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
    for (const th of this.thralls) { if (th.a.alive) { this.puffs.burst(_v.copy(th.a.position).setY(th.a.position.y + 1), 0.5, 2.5, 0.6, 0.7); this.retireThrall(th.a); } th.lane.cancel(); }
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
      this.lane.recoverNow();
    }
  }

  protected override action(k: Animal, move: 'roar' | 'sweep' | 'strike' | 'brace'): void {
    act(k, { roar: ACT_ROAR, sweep: ACT_SWEEP, strike: ACT_STRIKE, brace: ACT_BRACE }[move]);
  }
  protected override roar(k: Animal): void { voice(this.ctx.animals, 'bear_roar', k.position); }


  /** the stomp lands: dust, a shake, the root ring(s) race out */
  protected override stompNow(k: Animal): void {
    _v.set(k.position.x, k.position.y + 0.3, k.position.z);
    Impacts.for(this.ctx.game).burst('dirt', _v, _w.set(0, 1, 0), 24);
    this.ctx.shot('king_stomp', k.position);
    this.ctx.trauma(0.3);
    const n = this.phase >= 1 ? 2 : 1;
    this.waves.forEach((w, i) => { w.on = i < n; w.r = STOMP_R; w.hit = false; w.delay = i * 0.8; });
  }
  protected override tickWaves(k: Animal, dt: number, t: number): void {
    const p = this.ctx.player.position;
    const pd = Math.hypot(p.x - C.x, p.z - C.z) < FOG_R ? Math.hypot(p.x - k.position.x, p.z - k.position.z) : Infinity;
    for (const w of this.waves) {
      if (!w.on) { w.g.hide(); continue; }
      if (w.delay > 0) { w.delay -= dt; continue; }
      w.r += dt * 10.5;
      w.g.setTime(t);
      w.g.ring(k.position.x, k.position.z, w.r, 0.95, 0.25);
      if (!w.hit && pd !== Infinity) w.hit = pineContact(k, p, PINE_STRIKES.roots, (damage) => { this.ctx.hurt(k, damage, true); this.ctx.trauma(0.4); }, () => this.ctx.reach(k, p), { ringRadius: w.r, airborne: !this.ctx.player.onGround });
      if (w.r > FOG_R) { w.on = false; w.g.hide(); }
    }
  }

  // ── thralls ──
  protected override aliveThralls(): number { return this.thralls.filter((th) => th.a.alive).length; }
  protected override callThralls(n: number): void {
    const p = this.ctx.player.position;
    for (let i = 0; i < n; i++) {
      const lane = this.thrallLanes.find((l) => !this.thralls.some((th) => th.lane === l && th.a.alive));
      if (!lane) break;
      const ang = Math.random() * Math.PI * 2, x = C.x + Math.sin(ang) * 27, z = C.z + Math.cos(ang) * 27;
      const kind = i % 2 === 0 ? 'elk' : 'boar';
      const a = spawnThrallFrom(this.spawner, kind, x, z, headingTo(x, z, p.x, p.z), () => {
        const v = thrallVariant(kind), actor = this.ctx.animals.spawn(kind, x, z, headingTo(x, z, p.x, p.z), v.variant);
        if (v.tinted) tintThrall(actor);
        return actor;
      });
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
  private retireThrall(actor: Animal): void {
    if (this.spawner === null) retire(this.ctx.animals, actor);
    else this.spawner.retire(actor);
  }
  private clearAdds(): void {
    for (const th of this.thralls) { th.lane.cancel(); this.retireThrall(th.a); }
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
        let inside = false;
        const actor = this.king;
        if (actor) pineContact(actor, p, PINE_STRIKES.lantern, () => { inside = true; }, () => this.ctx.reach(actor, p), { origin: { x: f.x, y: f.y, z: f.z } });
        const r = burnTick(f.acc, dt, inside, 0.8);
        f.acc = r.acc;
        const k = this.king;
        if (r.bites > 0 && k) { this.ctx.hurt(k, PINE_STRIKES.lantern.damage * r.bites, true); }
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
    const dome = pineBackdrop(sky)?.dome.material;
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
  /** The resident fight remains frozen while these borrowed bindings leave with its entered scope. */
  entered?: (install: () => () => void) => void;
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

  constructor(private readonly host: AntlerKingHost) {
    const { ctx } = host;
    this.fight = new AntlerKingFight(ctx, host.entered);
    this.fight.prewarm();
    const def: BossDef = {
      ...ANTLER_KING_ENCOUNTER, phases: ANTLER_KING_ENCOUNTER.phases.map(({ at, caption, name }) => ({ at, caption, name })),
      reward: {
        tier: 'LEGENDARY', name: "THE WARDEN'S LONGBOW", flavour: 'his bow, and his amber for your crossbow', prompt: "Take the Warden's Longbow",
        model: () => ctx.longbow?.model() ?? ctx.skinModel('warden'),
        // the bow is kept by the loadout (Owned 'warden-longbow'), never by a pack slot (E314 C: a full pack lost it for good)
        grant: () => { ctx.ownSkin('warden'); ctx.longbow?.grant(); },
        trophy: () => { ctx.addItem('amber-resin', 3); }, // a re-fight's prize (was amber heartwood, which nothing used)
      },
    };
    const pl = ctx.player;
    this.boss = new Boss(def, this.fight, {
      scene: ctx.game.scene, player: pl, camera: ctx.game.camera, renderer: ctx.game.renderer,
      lockInput: (on) => { pl.carried = on; host.setWeaponsEnabled(!on); },
      respawn: (pos, yaw) => { pl.spawn(pos.x, pos.z, yaw); pl.pitch = 0; host.refill(); },
      addInteractable: (it) => { host.interactables.push(it); },
      removeInteractable: (it) => { const i = host.interactables.indexOf(it); if (i !== -1) host.interactables.splice(i, 1); },
      skipHeld: () => app.input.held('skip') || app.input.held('jump') || app.input.held('use') || app.input.held('confirm'),
      toast: ctx.toast, feed: ctx.feed, pickupHum: host.pickupHum,
      music: (e) => this.music(e),
    }, this.ui, 'pine-hollow');
    const scope = app.levelScope;
    if (scope !== null) app.encounters.boss(KING_KIND, this.boss, scope);
    // dev: `?boss=antler-king` — night, you at the stones' N gap; `&bossPhase=2|3` at that checkpoint
    if (host.params.get('boss') === KING_KIND) {
      this.forcedNight = true;
      void ctx.sky.dayNight?.set(PINE_PHASES.night);
      const from = Number(host.params.get('from') ?? '26');
      pl.spawn(C.x, C.z + (Number.isFinite(from) ? from : 26), 0);
      this.fight.setPresent(true); this.boss.arm();
      const ph = Number(host.params.get('bossPhase') ?? '1');
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
  }

  private music(e: 'intro' | 'phase' | 'victory' | 'death' | 'pickup'): void {
    const m = pineScore(this.host.music);
    if (e === 'intro') { m.setPineScene('boss'); m.setBossPhase(1); m.combat(1); }
    else if (e === 'phase') { const ph = this.fight.phase + 1; m.setBossPhase(ph === 3 ? 3 : ph === 2 ? 2 : 1); }
    else if (e === 'victory') { m.setPineScene(this.night() ? 'night' : 'day'); m.playSting('chunk'); }
    else if (e === 'death') { m.setPineScene(this.night() ? 'night' : 'day'); m.playSting('death'); }
    else m.playSting('pickup');
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
