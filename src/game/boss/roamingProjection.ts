/** Client-only roaming boss projection. All author input is rows and ids. */
import * as THREE from 'three';
import * as v from 'valibot';
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import { RoamingBossProjectionSchema, type RoamingBossProjectionRows } from '@wildshard/format/roamingBossProjection';
import type { RoamingEncounterRow } from '@wildshard/format/bossEncounter';
import type { SpeciesDecisionAuthority } from '../plugin/brain';
import { pageDecisionAuthority } from '../shardfile/borrowedDecisions';
import { pageCombatSession, type PageCombatSession } from '../Boss';
import { bindRuntimeBoss } from '../plugin/headless';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { prepareBossSocketRig, bindBossSocketRig, bossSocketResources, type BossSocketRig } from './socketRig';
import { keyedSkyOf } from '../looks/keyedSky';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import type { DamageDealt } from '@wildshard/engine/combat/pipeline';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { CueDirector } from '../audio/cueDirector';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { FixedPageSpawnTable } from '../population/pageGroups';
import { GroundTell } from '../Elite';
import { effectField } from '@wildshard/engine/fx/effectField';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import type { ShardContext } from '../plugin/context';
import { Rng, fnv1a32, type RngState } from '@wildshard/engine/core/rng';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Lane, type LaneState } from './lane';
import { bossFight, type RoamingBossFight, type RoamingBossPorts } from '../plugin/bossPhase';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';

interface HazardView { group: THREE.Group; flame: THREE.Object3D; ring: GroundTell; from: THREE.Vector3 }

/** a number some other system rewrites every frame (or never): scaled on top of whatever it holds this frame */
class Dim {
  private base = 0; private last = Number.NaN;
  apply(cur: number, k: number): number { if (cur !== this.last) this.base = cur; const value = this.base * k; this.last = value; return value; }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _col = new THREE.Color(), _fog = [0, 0, 0];


type ProjectionFight = RoamingBossFight<Animal, LaneState, RngState>;
type ProjectionPorts = RoamingBossPorts<Animal, LaneState, RngState, string, string, string>;
type ProjectionViews = Omit<ProjectionPorts, 'player' | 'random' | 'contact' | 'hurt' | 'trauma' | 'shot'>;
const damageOwners = new WeakMap<Animal, ProjectionFight>();
/** Species views query their actual entered fight; no damage callback is lent. */
export function roamingBossDamage(actor: Animal, point: THREE.Vector3): number { return damageOwners.get(actor)?.damageMul(actor, point) ?? 1; }

function createProjectionFight(env: PageCombatSession['context'], views: ProjectionViews, seed: number, program: SpeciesProgramData,
  decisions: SpeciesDecisionAuthority, row: RoamingEncounterRow): ProjectionFight {
  const species = program.species.find(candidate => candidate.kind === row.kind);
  if (species?.brain?.archetype !== 'decision' || species.body === undefined) throw new Error('Roaming boss requires its declared decision body');
  const declared = species.brain.data, recipe = species.body, bound = new WeakSet<Animal>();
  const bind = (actor: Animal): Animal => { if (!bound.has(actor)) { decisions.bind(actor, declared, recipe); bound.add(actor); } return actor; };
  const contacts = new Map(program.strikes.map(strike => [strike.id, strikeFromData(strike)])), runner = new StrikeRunner();
  const fight = bossFight(row.profile, { ...views, body: { ...views.body, make: () => bind(views.body.make()) }, player: env.player,
    random: { call: new Rng(fnv1a32(`${String(seed)}:${row.streams.call}`)), charge: new Rng(fnv1a32(`${String(seed)}:${row.streams.charge}`)) },
    contact: (actor, strike, hit, options) => {
      const spec = contacts.get(row.strikePrefix + strike); if (spec === undefined) throw new Error(`Missing roaming strike ${strike}`);
      if (!runner.contains(spec, { actor: { position: actor.position, scale: actor.scale, yaw: actor.yaw }, target: env.player.position, ...options })
        || (!spec.tags.includes('cover.exempt') && !env.reach(actor, env.player.position))) return false;
      hit(spec.damage); return true;
    }, hurt: (actor, damage, through) => { env.hurt(actor, damage, through); }, trauma: value => { env.trauma(value); }, shot: (sound, at) => { env.shot(sound, at); } });
  const restore = fight.restore.bind(fight);
  fight.restore = (saved, bodies) => {
    const actor = saved.body === null ? undefined : bodies.get(saved.body);
    if (actor !== undefined && !bound.has(actor)) { const state = actor.snapshot(); bind(actor); actor.restore(state); }
    restore(saved, bodies);
  };
  return fight;
}

/** The native lane owns contacts; this private projection paints its tell. */
class ProjectionLane extends Lane<Animal> {
  private readonly decal: GroundTell;
  private duration = 1;
  constructor(scene: THREE.Scene, colour: THREE.ColorRepresentation, strike: StrikeSpec, reach: PageCombatSession['context']['reach']) {
    super(strike, reach); this.decal = new GroundTell(scene, 'lane', colour);
  }
  dispose(): void { disposeTell(this.decal); }
  override start(actor: Animal, x: number, z: number, tell: number, speed = 1): void { this.duration = tell; super.start(actor, x, z, tell, speed); }
  override restore(saved: LaneState): void { super.restore(saved); this.duration = saved.tellT; }
  override cancel(): void { super.cancel(); this.decal.hide(); }
  override update(actor: Animal, dt: number, time: number, player: THREE.Vector3, hurt: (damage: number) => void): void {
    const state = this.state; if (state === 'none') return;
    const elapsed = this.t + dt; super.update(actor, dt, time, player, hurt); this.decal.setTime(time);
    if (state === 'tell') {
      const k = Math.min(1, elapsed / this.duration); this.decal.lane(this.x0, this.z0, this.x1, this.z1, this.width, .35 + .55 * k * (.75 + .25 * Math.sin(time * 22)));
    } else if (state === 'run') this.decal.lane(this.x0, this.z0, this.x1, this.z1, this.width, Math.max(0, .6 - elapsed * 1.2));
    else this.decal.hide();
  }
}
function disposeTell(tell: GroundTell): void {
  tell.mesh.removeFromParent(); tell.mesh.geometry.dispose();
  for (const material of Array.isArray(tell.mesh.material) ? tell.mesh.material : [tell.mesh.material]) material.dispose();
}

export async function installRoamingBossProjection(context: ShardContext, input: unknown): Promise<ProjectionFight> {
  const rows = v.parse(RoamingBossProjectionSchema, input), program = context.product.section('actors/species-programs').program;
  if (program === undefined) throw new Error('Roaming projection requires its species programme');
  const decisions = await pageDecisionAuthority(context); await prepareBossSocketRig(context, rows.socketRig);
  return context.scope.run(() => enterProjection(context, rows, program, decisions));
}
function enterProjection(context: ShardContext, rows: RoamingBossProjectionRows, program: SpeciesProgramData, decisions: SpeciesDecisionAuthority): ProjectionFight {
  const session = pageCombatSession(context.scope, rows.session), ctx = session.context, source = context.product.shardfile;
  const scene = ctx.game.scene, kit = bossSocketResources(context.scope, rows.socketRig.id), encounterRows = rows.encounter, actions = new Map(Object.entries(encounterRows.actions));
  const bodyOwner = bindRuntimeBoss(context, source, rows.spawn, undefined, { identity: 'runtime' });
  const spawner = new FixedPageSpawnTable(ctx.animals, context.app.encounters, context.scope, rows.spawnStream);
  const tellRing = new GroundTell(scene, 'ring', new THREE.Color(...rows.colours.tell));
  const waves = [0, 1].map(() => ({ g: new GroundTell(scene, 'ring', new THREE.Color(...rows.colours.wave)), r: 0, on: false, hit: false, delay: 0 }));
  const profiles = new Map(program.strikes.map(row => [row.id, strikeFromData(row)]));
  const bossLane = profiles.get(encounterRows.lanes.boss), thrallLane = profiles.get(encounterRows.lanes.add);
  if (bossLane === undefined || thrallLane === undefined) throw new Error('Missing declared roaming lanes');
  const lane = new ProjectionLane(scene, new THREE.Color(...rows.colours.tell), bossLane, ctx.reach);
  const addLanes = Array.from({ length: encounterRows.lanes.count }, () => new ProjectionLane(scene, new THREE.Color(...rows.colours.wave), thrallLane, ctx.reach));
  const C = encounterRows.profile.fight.origin, R = rows.wall.radius;
  const cues = new CueDirector(ctx.game, rows.cues, context.scope);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R * rows.wall.bottom, rows.wall.height, rows.wall.segments, 1, true).translate(0, rows.wall.height / 2, 0), lentLook(rows.wall.look));
  wall.position.set(C.x, heightAt(C.x, C.z) + rows.wall.lift, C.z); wall.visible = false; wall.frustumCulled = false; wall.renderOrder = rows.wall.order;
  wall.name = rows.wall.name; scene.add(wall);
  const puffs = new DomePuffs(scene, new THREE.Color(...rows.colours.puff), rows.puffs.count);
  const fallen: HazardView[] = rows.socketRig.hazards.map(() => {
    const group = new THREE.Group(); group.visible = false;
    const fire = effectField({ name: rows.hazard.name, shape: 'streak', count: 1 }, lentLook(rows.hazard.look)), flame = fire.object;
    context.scope.own(fire.geometry); context.scope.onDispose(() => { group.removeFromParent(); flame.removeFromParent(); });
    fire.place(_v.set(0, 0, 0), _w.set(0, 1, 0)); flame.scale.fromArray(rows.hazard.flameScale); flame.visible = false; flame.renderOrder = rows.hazard.order; scene.add(group, flame);
    const detached = new THREE.Group();
    for (const row of rows.hazard.meshes) { const mesh = new THREE.Mesh(kit.geometry(row.geometry), kit.standard(row.material)); mesh.castShadow = false; detached.add(mesh); }
    detached.scale.setScalar(rows.hazard.scale); group.add(detached);
    return { group, flame, ring: new GroundTell(scene, 'ring', new THREE.Color(...rows.colours.wave)), from: new THREE.Vector3() };
  });
  const pool = LightPool.for(scene);
  let light: THREE.PointLight | null = pool.acquire(rows.light.colour, 0, rows.light.distance, rows.light.decay);
  let look: BossSocketRig | null = null;
  const park = (a: Animal): void => {
    a.hidden = true; a.mesh.visible = false;
    const i = ctx.animals.animals.indexOf(a); if (i !== -1) ctx.animals.animals.splice(i, 1);
  };
  const fight: ProjectionFight = createProjectionFight(ctx, {
    groundAt: heightAt,
    body: {
      make: () => {
        const a = bodyOwner.spawn(); if (a === null) throw new Error('Missing native roaming boss body');
        pinBrain(a); inspectBrain(a, () => ({ state: fight.mode, picks: [], brainHz: 60, pinned: true }));
        const dressed = look = bindBossSocketRig(context.scope, rows.socketRig.id, a);
        const king = a.combatActor();
        const onDamage = ({ req }: DamageDealt): void => {
          if (req.target !== king) return;
          const { point, dir } = req;
          cues.cue(rows.events.hit, point, dir);
          if (point.distanceTo(dressed.focusWorld(_v)) < dressed.focusRadius) cues.cue(fight.open > 0.5 ? rows.events.open : rows.events.shut, point, dir);
        };
        context.on('damage.dealt', onDamage);
        installEnteredRuntimeService(context, scope => { damageOwners.set(a, fight); scope.onDispose(() => { if (damageOwners.get(a) === fight) damageOwners.delete(a); }); });
        return a;
      },
      retire: k => { look?.dispose(); look = null; ctx.animals.retire(k); }, park,
      unpark: a => { a.hidden = false; a.mesh.visible = true; if (!ctx.animals.animals.includes(a)) ctx.animals.animals.push(a); },
    },
    adds: {
      spawn: (kind, x, z, yaw) => {
        const a = spawner.spawn({ kind, tags: ['night'] }, { x, z, yaw }, { kind, variant: encounterRows.adds.variant });
        a.herd = -1; a.state = encounterRows.adds.state; a.scripted = true; return a;
      },
      retire: a => { spawner.retire(a); }, lanes: () => addLanes,
    },
    lane: () => lane, rings: () => waves,
    weakPoint: p => look !== null && p.distanceTo(look.focusWorld(_v)) < look.focusRadius,
    views: {
      glow: gain => { look?.setGlow(gain); }, hung: on => { look?.setHazardsHung(on); },
      focus: (k, out) => look === null ? out.copy(k.position) : look.focusWorld(out),
      room: (dt, t) => { room(dt, t); },
      light: on => {
        if (on) light ??= pool.acquire(rows.light.colour, 0, rows.light.distance, rows.light.decay);
        else if (light) { pool.release(light); light = null; }
      },
      action: (k, move) => { k.mem[encounterRows.actionField] = actions.get(move) ?? 0; }, roar: k => { ctx.animals.onSound?.(rows.roar, k.position); },
      burst: k => { cues.cue(rows.events.burst, k.position, _w.set(0, 1, 0)); },
      hazard: (i, f, t, event) => {
        const view = fallen[i]; if (view === undefined) return;
        if (event === 'drop') { look?.hazardWorld(i, view.from); view.group.visible = true; view.group.position.copy(view.from); }
        else if (event === 'fall' || event === 'land') {
          const u = f.fallT, from = view.from;
          view.group.position.set(from.x + (f.x - from.x) * u, from.y + (f.y + rows.hazard.landingLift - from.y) * u * u + Math.sin(u * Math.PI) * rows.hazard.arc, from.z + (f.z - from.z) * u);
          view.group.rotation.set(u * rows.hazard.rotation[0], u * rows.hazard.rotation[1], u * rows.hazard.rotation[2]);
          if (event === 'land') { ctx.shot(rows.landSound, _v.set(f.x, f.y, f.z)); cues.cue(rows.events.land, _v, _w.set(0, 1, 0)); }
        } else if (event === 'burn') {
          const ember = fight.darkK > 0 ? 1 - rows.hazard.dark * fight.darkK : 1;
          view.flame.visible = true; view.flame.position.set(f.x, f.y, f.z);
          setLentParam(rows.hazard.look, rows.hazard.alpha, rows.hazard.alphaBase * ember);
          view.ring.setTime(t);
          view.ring.ring(f.x, f.z, rows.hazard.radius, (rows.hazard.pulse[0] + rows.hazard.pulse[1] * Math.sin(t * rows.hazard.pulse[2] + f.x)) * ember, rows.hazard.width);
        } else if (event === 'placed') { view.group.visible = true; view.group.position.set(f.x, f.y + rows.hazard.landingLift, f.z); view.group.rotation.set(rows.hazard.rotation[0], i, rows.hazard.rotation[2]); }
        else { view.group.visible = false; view.flame.visible = false; view.ring.hide(); }
      },
      add: (a, event) => {
        if (event === 'in') puffs.burst(_v.set(a.position.x, heightAt(a.position.x, a.position.z) + rows.puffs.lift, a.position.z), ...rows.puffs.enter);
        else puffs.burst(_v.copy(a.position).setY(a.position.y + rows.puffs.lift), ...rows.puffs.leave);
      },
      ring: (i, t, at) => {
        const w = waves[i]; if (w === undefined) return;
        if (at === null) w.g.hide(); else { w.g.setTime(t); w.g.ring(at.x, at.z, w.r, 0.95, 0.25); }
      },
      tell: tellRing,
    },
  }, source.identity.seed, program, decisions, encounterRows);

  /** the fog wall, the puffs, the ribcage's opening and the fight's light, every frame (I–II: the ribcage's amber on the
   *  stones; III: your lantern) */
  function room(dt: number, t: number): void {
    const seal = rows.wall.seal * fight.sealK, fog = scene.fog;
    setLentParam(rows.wall.look, rows.wall.alpha, seal); wall.visible = seal > rows.wall.visible;
    if (fog instanceof THREE.Fog) setLentParam(rows.wall.look, rows.wall.colour, _col.copy(fog.color).multiplyScalar(rows.wall.colourGain).toArray(_fog));
    puffs.update(dt, t);
    if (fight.body === null || look === null) return;
    look.setOpen(Math.max(fight.open, 0.35 * fight.darkK), t);
    if (!light) return;
    if (fight.darkK > rows.light.darkness) {
      const c = ctx.game.camera.position;
      light.position.set(c.x, c.y + rows.light.playerAbove, c.z); light.color.fromArray(rows.light.playerColour); light.distance = rows.light.playerDistance; light.intensity = rows.light.playerGain * fight.darkK;
    } else {
      look.focusWorld(light.position); light.position.y += rows.light.focusAbove; light.color.fromArray(rows.light.focusColour); light.distance = rows.light.focusDistance;
      light.intensity = fight.won ? 0 : rows.light.focusGain * fight.glow * (rows.light.focusOpen[0] + rows.light.focusOpen[1] * fight.open);
    }
  }

  const dimFog = new Dim(), dimHemi = new Dim(), dimEnv = new Dim(), dimLights: Dim[] = [], dimDome = [new Dim(), new Dim()];
  const fogCol = new THREE.Color(), fogLast = new THREE.Color(-1, -1, -1);
  /** the fog closing (the seal) and the Last Light's dark, scaled on top of what the sky set this frame */
  const atmosphere = (): void => {
    const seal = fight.sealK, dark = fight.darkK;
    if (seal <= 0 && dark <= 0 && fogLast.r < 0) return;
    const sky = ctx.sky;
    fogUniforms.fogDistDensity.value = dimFog.apply(fogUniforms.fogDistDensity.value, 1 + rows.room.density[0] * seal + rows.room.density[1] * dark);
    const fog = scene.fog;
    if (fog instanceof THREE.Fog) {
      if (!fog.color.equals(fogLast)) fogCol.copy(fog.color);
      fog.color.copy(_col.copy(fogCol).multiplyScalar(1 - rows.room.fog[0] * seal - rows.room.fog[1] * dark));
      fogLast.copy(fog.color);
      if (seal <= 0 && dark <= 0) { fog.color.copy(fogCol); fogLast.setRGB(-1, -1, -1); }
    }
    sky.hemi.intensity = dimHemi.apply(sky.hemi.intensity, 1 - rows.room.hemi * dark);
    scene.environmentIntensity = dimEnv.apply(scene.environmentIntensity, 1 - rows.room.environment * dark);
    const dome = keyedSkyOf(sky)?.dome.material;
    if (dome instanceof THREE.ShaderMaterial) {
      const ga = dome.uniforms[rows.room.domeUniforms[0]], gb = dome.uniforms[rows.room.domeUniforms[1]], dk = 1 - rows.room.dome * dark;
      if (ga && typeof ga.value === 'number') ga.value = dimDome[0]?.apply(ga.value, dk) ?? ga.value;
      if (gb && typeof gb.value === 'number') gb.value = dimDome[1]?.apply(gb.value, dk) ?? gb.value;
    }
    sky.csm.lights.forEach((l, i) => {
      let dim = dimLights[i];
      if (dim === undefined) { dim = new Dim(); dimLights[i] = dim; }
      l.intensity = dim.apply(l.intensity, 1 - rows.room.lights * dark);
    });
  };

  const victory = fight.victory.bind(fight);
  fight.victory = () => { victory(); look?.setOpen(0, 0); };
  installEnteredRuntimeService(context, scope => {
    const descriptor = Object.getOwnPropertyDescriptor(scene, 'onBeforeRender'), previous = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args) => { atmosphere(); previous(...args); };
    scope.onDispose(() => { if (descriptor === undefined) Reflect.deleteProperty(scene, 'onBeforeRender'); else Object.defineProperty(scene, 'onBeforeRender', descriptor); });
  });
  const k = fight.spawn();
  if (TIER_CONFIG.furShells) { k.setShellLevel(rows.fur.prewarm); k.setShellLevel(rows.fur.parked); }
  fight.present = true; fight.setPresent(false);
  for (const row of rows.prewarm) park(ctx.animals.spawn(row.kind, C.x, C.z, 0, row.variant));
  context.scope.onDispose(() => {
    disposeTell(tellRing); for (const wave of waves) disposeTell(wave.g); for (const hazard of fallen) disposeTell(hazard.ring);
    lane.dispose(); for (const add of addLanes) add.dispose(); puffs.dispose();
    if (light !== null) { pool.release(light); light = null; } look?.dispose(); wall.removeFromParent(); wall.geometry.dispose(); });
  return fight;
}
