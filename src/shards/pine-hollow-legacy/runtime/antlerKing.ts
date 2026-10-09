import { pineScore } from '../runtime/audio/score';
import { installEnteredKingBindings } from './kingLifetime';
import { AntlerKingCore, KING_FOG_R, kingTick, type KingLantern } from '../combat/kingFight';
import { pineBackdrop } from '../look/skyBackdrop';
import { PINE_LANES } from '../combat/strikes';
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
import { Boss, type BossDef, type BossPersistence } from '@wildshard/game/Boss';
import { GroundTell } from '@wildshard/game/Elite';
import { PINE_PHASES } from '../look/dayKeys';
import { KINGS_CLEARING } from '../layout';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { FogWall, Puffs, flameCard } from '../combat/fxKit';
import { KING_VARIANT, dressAntlerKing, makeKingKit, kingOwnSpecies, type KingKit, type KingLook } from '../models/antlerKing';
import { ACT_BRACE, ACT_ROAR, ACT_STRIKE, ACT_SWEEP } from '../combat/kingRig';
import { own, retire, voice, LaneCharge, type PineCtx } from '../combat/ctx';
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

interface LanternView { group: THREE.Group; flame: { mesh: THREE.Mesh; mat: FxMaterial }; ring: GroundTell; from: THREE.Vector3 }

/** a number some other system rewrites every frame (or never): scaled on top of whatever it holds this frame */
class Dim {
  private base = 0; private last = Number.NaN;
  apply(cur: number, k: number): number { if (cur !== this.last) this.base = cur; const v = this.base * k; this.last = v; return v; }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _col = new THREE.Color();

/**
 * The page's King: the shared renderer-free fight (combat/kingFight.ts, AntlerKingCore: the BossScript, his moves, the root
 * rings, the lanterns, the thralls, every roll from the level seed's King streams) plus its views: his model and its look
 * (glow, ribcage, lanterns on the rack), the tells, the fog wall and the thick air, the fight's one light, the puffs, the
 * impacts, and the declared body / thrall spawner of the page's creature manager.
 */
export class AntlerKingFight extends AntlerKingCore<Animal> {
  look: KingLook | null = null;
  private readonly kit: KingKit;
  protected override readonly tellRing: GroundTell;
  protected override readonly waves: { g: GroundTell; r: number; on: boolean; hit: boolean; delay: number }[];
  protected override readonly lane: LaneCharge;
  protected override readonly thrallLanes: LaneCharge[];
  private readonly fallen: LanternView[] = [];
  private readonly wall: FogWall;
  private readonly puffs: Puffs;
  private light: THREE.PointLight | null = null;
  // the dimmers (the sky rewrites these every frame; the fight scales them after it)
  private readonly dimFog = new Dim(); private readonly dimHemi = new Dim(); private readonly dimEnv = new Dim();
  private readonly dimLights: Dim[] = [];
  private readonly dimDome = [new Dim(), new Dim()];
  private fogCol = new THREE.Color(); private fogLast = new THREE.Color(-1, -1, -1);
  /** thralls parked at boot so their programs compile with the rest (never shown) */
  private readonly parked: Animal[] = [];
  private readonly spawner: Spawner<Animal> | null;

  constructor(protected override readonly ctx: PineCtx, entered?: (install: () => () => void) => void, private readonly body?: () => Animal) {
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
    this.wall = new FogWall(scene, C.x, heightAt(C.x, C.z) - 2.5, C.z, KING_FOG_R, 22);
    this.puffs = new Puffs(scene, new THREE.Color(2.0, 1.1, 0.4), 3);
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group(); group.visible = false; scene.add(group);
      const flame = flameCard(EMBER, 1.3, 1.9); scene.add(flame.mesh);
      this.fallen.push({ group, flame, ring: new GroundTell(scene, 'ring', EMBER), from: new THREE.Vector3() });
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
        this.parkKing(a); this.parked.push(a);
      } catch (e) { console.warn('[antler-king] a thrall did not build', e); }
    }
  }

  private kitLantern(): THREE.Group {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.kit.frameGeo, this.kit.frameMat), new THREE.Mesh(this.kit.glassGeo, this.kit.glassMat));
    g.scale.setScalar(KING_VARIANT.scale[0]);
    return g;
  }

  // ── the page's bodies ──
  protected override groundAt(x: number, z: number): number { return heightAt(x, z); }
  /** out of every list (AI, minimap, aim, hitboxes), hidden, but still in the scene */
  protected override parkKing(a: Animal): void {
    a.hidden = true; a.mesh.visible = false;
    const i = this.ctx.animals.animals.indexOf(a); if (i !== -1) this.ctx.animals.animals.splice(i, 1);
  }
  protected override unparkKing(a: Animal): void {
    a.hidden = false; a.mesh.visible = true;
    if (!this.ctx.animals.animals.includes(a)) this.ctx.animals.animals.push(a);
  }
  protected override retireKing(k: Animal): void { this.look?.dispose(); this.look = null; retire(this.ctx.animals, k); }
  protected override makeKing(): Animal {
    const a = this.body === undefined ? this.ctx.animals.spawn(KING_KIND, C.x, C.z, 0, 'warden') : this.body();
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
  protected override spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): Animal {
    const a = spawnThrallFrom(this.spawner, kind, x, z, yaw, () => {
      const v = thrallVariant(kind), actor = this.ctx.animals.spawn(kind, x, z, yaw, v.variant);
      if (v.tinted) tintThrall(actor);
      return actor;
    });
    own(a);
    return a;
  }
  protected override retireThrall(actor: Animal): void {
    if (this.spawner === null) retire(this.ctx.animals, actor);
    else this.spawner.retire(actor);
  }
  protected override onRibs(p: THREE.Vector3): boolean { const l = this.look; return l !== null && p.distanceTo(l.ribcageWorld(_v)) < l.ribcageRadius; }

  // ── the views ──
  protected override glowTo(v: number): void { this.look?.setGlow(v); }
  protected override lanternsHung(on: boolean): void { this.look?.setLanternsHung(on); }
  protected override introFocus(k: Animal, out: THREE.Vector3): THREE.Vector3 { return this.look === null ? out.copy(k.position) : this.look.ribcageWorld(out); }
  protected override action(k: Animal, move: 'roar' | 'sweep' | 'strike' | 'brace'): void {
    act(k, { roar: ACT_ROAR, sweep: ACT_SWEEP, strike: ACT_STRIKE, brace: ACT_BRACE }[move]);
  }
  protected override roar(k: Animal): void { voice(this.ctx.animals, 'bear_roar', k.position); }
  protected override stompFx(k: Animal): void {
    _v.set(k.position.x, k.position.y + 0.3, k.position.z);
    Impacts.for(this.ctx.game).burst('dirt', _v, _w.set(0, 1, 0), 24);
  }
  protected override waveView(i: number, t: number, at: THREE.Vector3 | null): void {
    const w = this.waves[i]; if (w === undefined) return;
    if (at === null) { w.g.hide(); return; }
    w.g.setTime(t); w.g.ring(at.x, at.z, w.r, 0.95, 0.25);
  }
  protected override thrallView(a: Animal, event: 'in' | 'out'): void {
    if (event === 'in') this.puffs.burst(_v.set(a.position.x, heightAt(a.position.x, a.position.z) + 1, a.position.z), 2.5, 0.6, 0.6, 0.6);
    else this.puffs.burst(_v.copy(a.position).setY(a.position.y + 1), 0.5, 2.5, 0.6, 0.7);
  }
  protected override lanternView(i: number, f: KingLantern, t: number, event: 'drop' | 'fall' | 'land' | 'burn' | 'out' | 'placed'): void {
    const view = this.fallen[i]; if (view === undefined) return;
    if (event === 'drop') { this.look?.lanternWorld(i, view.from); view.group.visible = true; view.group.position.copy(view.from); }
    else if (event === 'fall' || event === 'land') {
      const u = f.fallT, from = view.from;
      view.group.position.set(from.x + (f.x - from.x) * u, from.y + (f.y + 0.3 - from.y) * u * u + Math.sin(u * Math.PI) * 2, from.z + (f.z - from.z) * u);
      view.group.rotation.set(u * 1.3, u * 2, u * 0.4);
      if (event === 'land') { this.ctx.shot('lanternLight', _v.set(f.x, f.y, f.z)); Impacts.for(this.ctx.game).burst('sparks', _v.set(f.x, f.y + 0.3, f.z), _w.set(0, 1, 0), 16); }
    } else if (event === 'burn') {
      const ember = this.darkK > 0 ? 1 - 0.5 * this.darkK : 1;
      view.flame.mesh.visible = true; view.flame.mesh.position.set(f.x, f.y, f.z);
      view.flame.mat.uniforms.uAlpha.value = 0.95 * ember; view.flame.mat.uniforms.uTime.value = t;
      view.ring.setTime(t);
      view.ring.ring(f.x, f.z, 3.2, (0.35 + 0.15 * Math.sin(t * 5 + f.x)) * ember, 0.2);
    } else if (event === 'placed') { view.group.visible = true; view.group.position.set(f.x, f.y + 0.3, f.z); view.group.rotation.set(1.3, i, 0.4); }
    else { view.group.visible = false; view.flame.mesh.visible = false; view.ring.hide(); }
  }
  /** the fog wall, the puffs, the ribcage's opening and the fight's light, every frame */
  protected override room(dt: number, t: number): void {
    this.wall.alpha = 0.92 * this.sealK;
    this.wall.update(t, this.ctx.game.scene.fog instanceof THREE.Fog ? this.ctx.game.scene.fog.color : null);
    this.puffs.update(dt, t);
    const look = this.look;
    if (this.king === null || look === null) return;
    look.setOpen(Math.max(this.open, 0.35 * this.darkK), t);
    this.updateLight();
  }
  protected override lightOn(): void { this.light ??= LightPool.for(this.ctx.game.scene).acquire(0xffa040, 0, 18, 1.6); }
  protected override lightOff(): void { if (this.light) { LightPool.for(this.ctx.game.scene).release(this.light); this.light = null; } }
  override victory(): void { super.victory(); this.look?.setOpen(0, 0); }

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
  /** The platform owns encounter records and declared body placement; the fight keeps its native recipe. */
  persistence?: BossPersistence;
  body?: () => Animal;
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
    this.fight = new AntlerKingFight(ctx, host.entered, host.body);
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
    }, this.ui, 'pine-hollow', host.persistence);
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
    kingTick(this.boss, this.fight, this.host.ctx.player.position, this.night(), dt, t);
  }

  onPlayerDeath(): boolean { return this.boss.onPlayerDeath(); }
}
