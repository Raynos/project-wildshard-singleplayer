import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import type { SpeciesDecisionAuthority } from '@wildshard/game/plugin/brain';
import { installEnteredKingBindings } from './kingLifetime';
import { kingFight, type KingFight } from '../combat/kingFight';
import { keyedSkyOf } from '@wildshard/game/looks/keyedSky';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { app } from '@wildshard/engine/app/runtime';
import type { DamageDealt } from '@wildshard/engine/combat/pipeline';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { registerSpecies, variantDef, hasSpecies, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { pineGrazer } from '../species/looks';
import { Impacts } from '@wildshard/engine/fx/Impacts';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { thrallSpawner, spawnThrallFrom } from '../combat/spawns';
import * as THREE from 'three';
import type { BossEncounter } from '@wildshard/game/Boss';
import { GroundTell } from '@wildshard/game/Elite';
import { pineView } from './world/context';
import { Puffs } from './combat/fxKit';
import { effectField } from '@wildshard/sdk/looks/effectField';
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';
import { KING_VARIANT, dressAntlerKing, makeKingKit, kingLantern, kingOwnSpecies, type KingLook } from './models/antlerKing';
import { own, retire, voice, LaneCharge, type PineCtx } from '../combat/ctx';

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
 *     variant of elk / boar) — they charge down lanes. Stomps come in pairs.
 *   III · THE LAST LIGHT (30 → 0 %): the clearing goes dark (fog thick and black, moon and sky light down) but for his
 *     ribcage and the lantern you carry (the fight's one pooled light moves to you); he charges DOWN LANES across the
 *     clearing, chaining two or three, the ribcage flaring open at every skid.
 *
 *   Checkpoints per phase (Boss.ts): die and you are back at the stones' N gap, bolts refilled, the King at the start of
 *   the phase you reached. The reward (the gold legendary orb, once): THE WARDEN'S LONGBOW — the bow itself (PH-C11,
 *   src/engine/player/Longbow.ts, adapted from Nalati's Bow.ts) joins the kit, with the WARDEN crossbow skin and the
 *   Owned 'warden-longbow' that keeps it across sessions (E314 C, src/shards/pine-hollow/loadout/loadout.ts); a re-fight pays 3 amber resin. Music: Music.ts's Pine Hollow boss slot (setScene('boss') / setBossPhase).
 *
 *   STAND-IN MODEL: src/shards/pine-hollow/runtime/models/antlerKing.ts (the elk rig ×2.6, bark coat, lanterns, ribcage, skull) — `dressAntlerKing` is the one
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
const AMBER_TELL = new THREE.Color(1.5, 0.62, 0.12), EMBER = new THREE.Color(2.6, 1.1, 0.3);

let kingDamage: ((a: Animal, p: THREE.Vector3) => number) | null = null;

/** the King's species: the elk's fields re-registered as 'antler-king' — its own AI (the fight drives it), no blood (bark) —
 *  on his own upright rig (E322 F-M1, kingOwnSpecies) */
export function registerKing(): void {
  if (hasSpecies(KING_KIND)) return;
  const elk: SpeciesDef = pineGrazer('elk');
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

/** The variant a thrall of `kind` is spawned as: the creature lane's registered 'thrall' (Pine registers one for elk and
 *  boar); a missing one is a content error, never a stand-in. */
export function thrallVariant(kind: 'elk' | 'boar'): string {
  if (variantDef(kind, 'thrall').id !== 'thrall') throw new Error(`[antler-king] no 'thrall' variant registered for ${kind}`);
  return 'thrall';
}

interface LanternView { group: THREE.Group; flame: THREE.Object3D; ring: GroundTell; from: THREE.Vector3 }

/** a number some other system rewrites every frame (or never): scaled on top of whatever it holds this frame */
class Dim {
  private base = 0; private last = Number.NaN;
  apply(cur: number, k: number): number { if (cur !== this.last) this.base = cur; const v = this.base * k; this.last = v; return v; }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _col = new THREE.Color(), _fog = [0, 0, 0];

/**
 * The page's King: the shared roaming phasedBoss fight (combat/kingFight.ts: the BossScript, his moves, the root rings, the
 * lanterns, the thralls, every roll from the level seed's King streams) bound to its views: his model and its look (glow,
 * ribcage, lanterns on the rack), the tells, the fog wall and the thick air, the fight's one light, the puffs, the impacts,
 * and the declared body / thrall spawner of the page's creature manager. The King and a thrall of each kind are made at
 * boot (their models and programs compile with the rest) and parked.
 */
export function antlerKingFight(ctx: PineCtx, seed:number, program:SpeciesProgramData, decisions:SpeciesDecisionAuthority, entered?: (install: () => () => void) => void, body?: () => Animal): KingFight<Animal> {
  const scene = ctx.game.scene, kit = makeKingKit(ctx.sky), encounterRows = pineView().BOSS_ENCOUNTER, actions = new Map(Object.entries(encounterRows.actions));
  const spawner = thrallSpawner(ctx.animals, (kind, x, z, yaw) => ctx.animals.spawn(kind, x, z, yaw, thrallVariant(kind)));
  const tellRing = new GroundTell(scene, 'ring', AMBER_TELL);
  const waves = [0, 1].map(() => ({ g: new GroundTell(scene, 'ring', EMBER), r: 0, on: false, hit: false, delay: 0 }));
  const profiles = new Map(program.strikes.map(row => [row.id, strikeFromData(row)]));
  const kingLane = profiles.get('strike.antler-king.last-light'), thrallLane = profiles.get('strike.antler-king.thrall');
  if (kingLane === undefined || thrallLane === undefined) throw new Error('Missing admitted King lanes');
  const lane = new LaneCharge(scene, AMBER_TELL, kingLane, ctx.reach);
  const thrallLanes = [0, 1, 2].map(() => new LaneCharge(scene, EMBER, thrallLane, ctx.reach));
  // the fog wall: an open cylinder round the clearing in its graph (data/kingFxLook.ts), thick at the foot
  const { KINGS_CLEARING: C, KING_ARENA_FOG: R, KING_FX_LOOKS } = pineView();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, 22, 96, 1, true).translate(0, 11, 0), lentLook(KING_FX_LOOKS.fog));
  wall.position.set(C.x, heightAt(C.x, C.z) - 2.5, C.z); wall.visible = false; wall.frustumCulled = false; wall.renderOrder = 26;
  wall.name = 'antler-king-fog-wall'; scene.add(wall);
  const puffs = new Puffs(scene, new THREE.Color(2.0, 1.1, 0.4), 3);
  const fallen: LanternView[] = [0, 1, 2].map(() => {
    const group = new THREE.Group(); group.visible = false;
    // a fallen lantern's fire: the SDK's crossed streak quads stood upright (1.3 wide, 1.9 tall) in its flame graph
    const fire = effectField({ name: 'antler-king-lantern-fire', shape: 'streak', count: 1 }, lentLook(KING_FX_LOOKS.flame)), flame = fire.object;
    fire.place(_v.set(0, 0, 0), _w.set(0, 1, 0)); flame.scale.set(1.3, 1.3, 1.9); flame.visible = false; flame.renderOrder = 27; scene.add(group, flame);
    const lantern = kingLantern(kit); lantern.scale.setScalar(KING_VARIANT.scale[0]); group.add(lantern);
    return { group, flame, ring: new GroundTell(scene, 'ring', EMBER), from: new THREE.Vector3() };
  });
  // the fight's one light: taken from the scene's LightPool at boot (a constant light count — no recompile), dark until the
  // fight; released between fights so an elite's orb can borrow it
  const pool = LightPool.for(scene);
  let light: THREE.PointLight | null = pool.acquire(0xffa040, 0, 18, 1.6);
  let look: KingLook | null = null;
  registerKing();
  const park = (a: Animal): void => {
    a.hidden = true; a.mesh.visible = false;
    const i = ctx.animals.animals.indexOf(a); if (i !== -1) ctx.animals.animals.splice(i, 1);
  };
  const fight: KingFight<Animal> = kingFight(ctx, {
    groundAt: heightAt,
    body: {
      make: () => {
        const a = body === undefined ? ctx.animals.spawn(KING_KIND, C.x, C.z, 0, 'warden') : body();
        pinBrain(a); inspectBrain(a, () => ({ state: fight.mode, picks: [], brainHz: 60, pinned: true }));
        const dressed = look = dressAntlerKing(a, kit);
        // bark, not blood: splinters and embers where a bolt lands
        const king = a.combatActor();
        const onDamage = ({ req }: DamageDealt): void => {
          if (req.target !== king) return;
          const { point, dir } = req;
          _w.copy(dir).negate();
          Impacts.for(ctx.game).burst('wood', point, _w, 8);
          if (point.distanceTo(dressed.ribcageWorld(_v)) < dressed.ribcageRadius) Impacts.for(ctx.game).burst('sparks', point, _w, fight.open > 0.5 ? 14 : 5);
        };
        if (ctx.onDamage === undefined) app.events.on('damage.dealt', onDamage, ctx.game.levelScope);
        else ctx.onDamage(onDamage);
        return a;
      },
      retire: k => { look?.dispose(); look = null; retire(ctx.animals, k); }, park,
      unpark: a => { a.hidden = false; a.mesh.visible = true; if (!ctx.animals.animals.includes(a)) ctx.animals.animals.push(a); },
    },
    adds: {
      spawn: (kind, x, z, yaw) => {
        const a = spawnThrallFrom(spawner, kind, x, z, yaw, () => ctx.animals.spawn(kind, x, z, yaw, thrallVariant(kind)));
        own(a); return a;
      },
      retire: a => { if (spawner === null) retire(ctx.animals, a); else spawner.retire(a); }, lanes: () => thrallLanes,
    },
    lane: () => lane, rings: () => waves,
    weakPoint: p => look !== null && p.distanceTo(look.ribcageWorld(_v)) < look.ribcageRadius,
    views: {
      glow: v => { look?.setGlow(v); }, hung: on => { look?.setLanternsHung(on); },
      focus: (k, out) => look === null ? out.copy(k.position) : look.ribcageWorld(out),
      room: (dt, t) => { room(dt, t); },
      light: on => {
        if (on) light ??= pool.acquire(0xffa040, 0, 18, 1.6);
        else if (light) { pool.release(light); light = null; }
      },
      action: (k, move) => { k.mem['act'] = actions.get(move) ?? 0; }, roar: k => { voice(ctx.animals, 'bear_roar', k.position); },
      burst: k => { Impacts.for(ctx.game).burst('dirt', _v.set(k.position.x, k.position.y + 0.3, k.position.z), _w.set(0, 1, 0), 24); },
      hazard: (i, f, t, event) => {
        const view = fallen[i]; if (view === undefined) return;
        if (event === 'drop') { look?.lanternWorld(i, view.from); view.group.visible = true; view.group.position.copy(view.from); }
        else if (event === 'fall' || event === 'land') {
          const u = f.fallT, from = view.from;
          view.group.position.set(from.x + (f.x - from.x) * u, from.y + (f.y + 0.3 - from.y) * u * u + Math.sin(u * Math.PI) * 2, from.z + (f.z - from.z) * u);
          view.group.rotation.set(u * 1.3, u * 2, u * 0.4);
          if (event === 'land') { ctx.shot('lanternLight', _v.set(f.x, f.y, f.z)); Impacts.for(ctx.game).burst('sparks', _v.set(f.x, f.y + 0.3, f.z), _w.set(0, 1, 0), 16); }
        } else if (event === 'burn') {
          const ember = fight.darkK > 0 ? 1 - 0.5 * fight.darkK : 1;
          view.flame.visible = true; view.flame.position.set(f.x, f.y, f.z);
          setLentParam(KING_FX_LOOKS.flame, 'alpha', 0.95 * ember);
          view.ring.setTime(t);
          view.ring.ring(f.x, f.z, 3.2, (0.35 + 0.15 * Math.sin(t * 5 + f.x)) * ember, 0.2);
        } else if (event === 'placed') { view.group.visible = true; view.group.position.set(f.x, f.y + 0.3, f.z); view.group.rotation.set(1.3, i, 0.4); }
        else { view.group.visible = false; view.flame.visible = false; view.ring.hide(); }
      },
      add: (a, event) => {
        if (event === 'in') puffs.burst(_v.set(a.position.x, heightAt(a.position.x, a.position.z) + 1, a.position.z), 2.5, 0.6, 0.6, 0.6);
        else puffs.burst(_v.copy(a.position).setY(a.position.y + 1), 0.5, 2.5, 0.6, 0.7);
      },
      ring: (i, t, at) => {
        const w = waves[i]; if (w === undefined) return;
        if (at === null) w.g.hide(); else { w.g.setTime(t); w.g.ring(at.x, at.z, w.r, 0.95, 0.25); }
      },
      tell: tellRing,
    },
  }, seed, program, decisions);

  /** the fog wall, the puffs, the ribcage's opening and the fight's light, every frame (I–II: the ribcage's amber on the
   *  stones; III: your lantern) */
  function room(dt: number, t: number): void {
    const seal = 0.92 * fight.sealK, fog = scene.fog;
    setLentParam(KING_FX_LOOKS.fog, 'alpha', seal); wall.visible = seal > 0.01;
    // the wall is the scene fog's murk this frame
    if (fog instanceof THREE.Fog) setLentParam(KING_FX_LOOKS.fog, 'colour', _col.copy(fog.color).multiplyScalar(1.15).toArray(_fog));
    puffs.update(dt, t);
    if (fight.body === null || look === null) return;
    look.setOpen(Math.max(fight.open, 0.35 * fight.darkK), t);
    if (!light) return;
    if (fight.darkK > 0.5) {
      const c = ctx.game.camera.position;
      light.position.set(c.x, c.y + 0.3, c.z); light.color.setRGB(1, 0.72, 0.4); light.distance = 16; light.intensity = 16 * fight.darkK;
    } else {
      look.ribcageWorld(light.position); light.position.y += 0.5; light.color.setRGB(1, 0.55, 0.18); light.distance = 20;
      light.intensity = fight.won ? 0 : 30 * fight.glow * (0.6 + 0.8 * fight.open);
    }
  }

  // the dimmers (the sky rewrites these every frame; the fight scales them after it)
  const dimFog = new Dim(), dimHemi = new Dim(), dimEnv = new Dim(), dimLights: Dim[] = [], dimDome = [new Dim(), new Dim()];
  const fogCol = new THREE.Color(), fogLast = new THREE.Color(-1, -1, -1);
  /** the fog closing (the seal) and the Last Light's dark, scaled on top of what the sky set this frame */
  const atmosphere = (): void => {
    const seal = fight.sealK, dark = fight.darkK;
    if (seal <= 0 && dark <= 0 && fogLast.r < 0) return;
    const sky = ctx.sky;
    // density: × 26 in the fight, × 76 in the dark (the night preset’s 0.0007 → ~0.018 / ~0.05)
    fogUniforms.fogDistDensity.value = dimFog.apply(fogUniforms.fogDistDensity.value, 1 + 25 * seal + 50 * dark);
    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      if (!fog.color.equals(fogLast)) fogCol.copy(fog.color);
      fog.color.copy(_col.copy(fogCol).multiplyScalar(1 - 0.35 * seal - 0.55 * dark));
      fogLast.copy(fog.color);
      if (seal <= 0 && dark <= 0) { fog.color.copy(fogCol); fogLast.setRGB(-1, -1, -1); }
    }
    sky.hemi.intensity = dimHemi.apply(sky.hemi.intensity, 1 - 0.8 * dark);
    scene.environmentIntensity = dimEnv.apply(scene.environmentIntensity, 1 - 0.75 * dark);
    const dome = keyedSkyOf(sky)?.dome.material;
    if (dome instanceof THREE.ShaderMaterial) {
      const ga = dome.uniforms['uGainA'], gb = dome.uniforms['uGainB'], dk = 1 - 0.85 * dark;
      if (ga && typeof ga.value === 'number') ga.value = dimDome[0]?.apply(ga.value, dk) ?? ga.value;
      if (gb && typeof gb.value === 'number') gb.value = dimDome[1]?.apply(gb.value, dk) ?? gb.value;
    }
    sky.csm.lights.forEach((l, i) => {
      let dim = dimLights[i];
      if (dim === undefined) { dim = new Dim(); dimLights[i] = dim; }
      l.intensity = dim.apply(l.intensity, 1 - 0.85 * dark);
    });
  };

  const victory = fight.victory.bind(fight);
  fight.victory = () => { victory(); look?.setOpen(0, 0); };
  const damage = (a: Animal, p: THREE.Vector3): number => fight.damageMul(a, p);
  // the sky rewrites the fog / lights every frame AFTER the updaters (Game.loop: updaters → sky.update → render), so the
  // fight's thick air is laid on at the scene's render, on top of this frame's sky
  if (entered === undefined) {
    kingDamage = damage;
    const prev = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args) => { atmosphere(); prev(...args); };
  } else installEnteredKingBindings(scene, { read: () => kingDamage, write: (value) => { kingDamage = value; } }, damage, atmosphere, entered);

  // boot: the King and a thrall of each kind made now (their models + programs compile with the rest), parked. Desktop's
  // fur shells (tier furShells) are made on the parked King so their 8 programs compile at boot, not mid-fight.
  const k = fight.spawn();
  if (TIER_CONFIG.furShells) { k.setShellLevel(8); k.setShellLevel(0); }
  fight.present = true; fight.setPresent(false);
  for (const kind of ['elk', 'boar'] as const) {
    try { park(ctx.animals.spawn(kind, C.x, C.z, 0, thrallVariant(kind))); }
    catch (e) { console.warn('[antler-king] a thrall did not build', e); }
  }
  return fight;
}

// ─────────────────────────────── the wiring ───────────────────────────────

/** The page's encounter handle retains its actual King fight and bar for the existing combat owners. */
export type AntlerKing = BossEncounter<KingFight<Animal>>;
