import { CueDirector } from '../audio/cueDirector';
/** Client-only roaming boss projection. All author input is rows and ids. */
import * as THREE from 'three';
import * as v from 'valibot';
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import { RoamingBossProjectionSchema, type RoamingBossProjectionRows } from '@wildshard/format/roamingBossProjection';
import type { RoamingEncounterRow } from '@wildshard/format/bossEncounter';
import type { SpeciesDecisionAuthority } from '../../server/plugin/brain';
import { pageSim } from '../shardfile/clientMoverOwners';
import { pageCombatSession, type PageCombatSession } from '../Boss';
import { bindRuntimeBoss } from '../../shared/plugin/runtimeRows';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { prepareBossSocketRig, bindBossSocketRig, bossSocketResources, type BossSocketRig } from './socketRig';
import { keyedSkyOf } from '../looks/keyedSky';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { pinBrain } from '@wildshard/engine/ai/pinning';
import type { DamageDealt } from '@wildshard/engine/combat/pipeline';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { GroundTell } from '../eliteView';
import { effectField } from '@wildshard/engine/fx/effectField';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import type { ShardContext } from '../plugin/context';
import { Rng, fnv1a32, type RngState } from '@wildshard/engine/core/rng';
import { StrikeRunner, type StrikeSpec } from '@wildshard/engine/ai/strikes';
import { Lane, type LaneState } from '../../shared/boss/lane';
import type { RoamingBossFight, RoamingBossPorts, RoamingBossRing } from '../../server/plugin/bossPhase';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';
import { wirePage } from '../shardfile/wirePage';
import { ROAMING_HAZARD_EVENTS, ROAMING_VIEW } from '../../shared/shardfile/wirePrompts';

/** The lane states `ROAMING_VIEW.lane` numbers. */
const LANE_STATES = ['none', 'tell', 'run', 'skid'] as const;

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
  const fight = pageSim.bossFight(row.profile, { ...views, body: { ...views.body, make: () => bind(views.body.make()) }, player: env.player,
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
    const elapsed = this.t + dt; super.update(actor, dt, time, player, hurt);
    this.paint(state, elapsed, this.duration, this.x0, this.z0, this.x1, this.z1, this.width, time);
  }
  /** One frame of the tell: a page on a server has it from the server's lane, whose runner it doesn't step. */
  paint(state: string, elapsed: number, duration: number, x0: number, z0: number, x1: number, z1: number, width: number, time: number): void {
    this.decal.setTime(time);
    if (state === 'tell') {
      const k = Math.min(1, elapsed / duration); this.decal.lane(x0, z0, x1, z1, width, .35 + .55 * k * (.75 + .25 * Math.sin(time * 22)));
    } else if (state === 'run') this.decal.lane(x0, z0, x1, z1, width, Math.max(0, .6 - elapsed * 1.2));
    else this.decal.hide();
  }
  hide(): void { this.decal.hide(); }
}
function disposeTell(tell: GroundTell): void {
  tell.mesh.removeFromParent(); tell.mesh.geometry.dispose();
  for (const material of Array.isArray(tell.mesh.material) ? tell.mesh.material : [tell.mesh.material]) material.dispose();
}

/** The room and its light on a server's page, as that server's fight last said them. */
interface HeardRoom { sealK: number; darkK: number; glow: number; open: number; hung: boolean; readonly won: false; readonly focus: THREE.Vector3 }
/** A page on a server steps no fight: what the server's fight tells its views paints these, and a lane that stops being said ends. */
interface FollowedFight {
  readonly rows: RoamingBossProjectionRows; readonly ring: ProjectionViews['views']['ring']; readonly hazard: ProjectionViews['views']['hazard']; readonly cues: NonNullable<ReturnType<typeof CueDirector.entered>>;
  readonly lane: ProjectionLane; readonly addLanes: readonly ProjectionLane[]; readonly tellRing: GroundTell; readonly puffs: DomePuffs;
  readonly waves: readonly RoamingBossRing[]; readonly heardRoom: HeardRoom; readonly hazardFrom: THREE.Vector3;
  readonly room: (dt: number, t: number) => void; readonly sound: (at: THREE.Vector3) => void; readonly light: (on: boolean) => void; readonly rig: () => void;
  readonly struck: (point: THREE.Vector3, dir: THREE.Vector3) => void;
}
const LANE_HEARD_FOR = 0.25;
/** A lane heard since the last frame. */
const FRESH = Number.POSITIVE_INFINITY;
function followRoamingFight(context: ShardContext, { rows, ring, hazard, cues, lane, addLanes, tellRing, puffs, waves, heardRoom, hazardFrom, room, sound, light, rig, struck }: FollowedFight): void {
  const lanes = [lane, ...addLanes], heard = lanes.map(() => Number.NEGATIVE_INFINITY), point = new THREE.Vector3(), up = new THREE.Vector3();
  const actions: Readonly<Record<string, (args: readonly number[]) => void>> = {
    [ROAMING_VIEW.roar]: ([x = 0, y = 0, z = 0]) => { sound(point.set(x, y, z)); },
    [ROAMING_VIEW.burst]: ([x = 0, y = 0, z = 0]) => { cues.cue(rows.events.burst, point.set(x, y, z), up.set(0, 1, 0)); },
    [ROAMING_VIEW.add]: ([arrives = 0, x = 0, y = 0, z = 0]) => {
      if (arrives === 1) puffs.burst(point.set(x, heightAt(x, z) + rows.puffs.lift, z), ...rows.puffs.enter); else puffs.burst(point.set(x, y + rows.puffs.lift, z), ...rows.puffs.leave);
    },
    [ROAMING_VIEW.ring]: ([index = 0, t = 0, shown = 0, x = 0, z = 0, radius = 0]) => {
      const wave = waves[index]; if (wave === undefined) return;
      wave.r = radius; ring(index, t, shown === 1 ? point.set(x, 0, z) : null);
    },
    [ROAMING_VIEW.tell]: ([x = 0, z = 0, radius = 0, alpha = 0, t = 0]) => { tellRing.setTime(t); tellRing.ring(x, z, radius, alpha); },
    [ROAMING_VIEW.tellOff]: () => { tellRing.hide(); },
    [ROAMING_VIEW.lane]: ([slot = 0, state = 0, elapsed = 0, duration = 1, x0 = 0, z0 = 0, x1 = 0, z1 = 0, width = 0, t = 0]) => {
      lanes[slot]?.paint(LANE_STATES[state] ?? 'none', elapsed, duration, x0, z0, x1, z1, width, t); heard[slot] = FRESH;
    },
    [ROAMING_VIEW.room]: ([sealK = 0, darkK = 0]) => { heardRoom.sealK = sealK; heardRoom.darkK = darkK; },
    [ROAMING_VIEW.light]: ([on = 0, x = 0, y = 0, z = 0, glow = 0, open = 0]) => { heardRoom.focus.set(x, y, z); heardRoom.glow = glow; heardRoom.open = open; light(on === 1); },
    [ROAMING_VIEW.rig]: ([glow = 0, open = 0, hung = 0]) => { heardRoom.glow = glow; heardRoom.open = open; heardRoom.hung = hung === 1; rig(); },
    [ROAMING_VIEW.struck]: ([x = 0, y = 0, z = 0, dx = 0, dy = 0, dz = 0]) => { struck(point.set(x, y, z), up.set(dx, dy, dz)); },
    [ROAMING_VIEW.hazard]: ([index = 0, event = 0, t = 0, x = 0, y = 0, z = 0, fallT = 0, fromX = 0, fromY = 0, fromZ = 0]) => {
      const beat = ROAMING_HAZARD_EVENTS[event]; if (beat === undefined) return;
      hazardFrom.set(fromX, fromY, fromZ); hazard(index, { x, y, z, fallT, acc: 0 }, t, beat);
    },
  };
  wirePage.whenLive(context.scope, client => client.onView(({ name, args }) => { actions[name]?.(args); }));
  context.system({ id: 'roaming.followed', phase: 'update', run: (dt, t) => {
    room(dt, t);
    for (const [slot, row] of lanes.entries()) {
      if (heard[slot] === FRESH) heard[slot] = t; // the clock's the frame's: a slow frame still shows what it heard
      else if (t - (heard[slot] ?? 0) > LANE_HEARD_FOR) row.hide();
    }
  } });
}
export async function installRoamingBossProjection(context: ShardContext, input: unknown): Promise<ProjectionFight> {
  const rows = v.parse(RoamingBossProjectionSchema, input), program = context.product.section('actors/species-programs').program;
  if (program === undefined) throw new Error('Roaming projection requires its species programme');
  const decisions = await pageSim.pageDecisionAuthority(context); await prepareBossSocketRig(context, rows.socketRig);
  return context.scope.run(() => enterProjection(context, rows, program, decisions));
}
function enterProjection(context: ShardContext, rows: RoamingBossProjectionRows, program: SpeciesProgramData, decisions: SpeciesDecisionAuthority): ProjectionFight {
  const session = pageCombatSession(context.scope, rows.session), ctx = session.context, source = context.product.shardfile;
  const scene = ctx.game.scene, kit = bossSocketResources(context.scope, rows.socketRig.id), encounterRows = rows.encounter, actions = new Map(Object.entries(encounterRows.actions));
  const bodyOwner = bindRuntimeBoss(context, source, rows.spawn, undefined, { identity: 'runtime' });
  const spawner = pageSim.fixedSpawnTable(ctx.animals, context.app.encounters, context.scope, rows.spawnStream);
  const tellRing = new GroundTell(scene, 'ring', new THREE.Color(...rows.colours.tell));
  const waves = [0, 1].map(() => ({ g: new GroundTell(scene, 'ring', new THREE.Color(...rows.colours.wave)), r: 0, on: false, hit: false, delay: 0 }));
  const profiles = new Map(program.strikes.map(row => [row.id, strikeFromData(row)]));
  const bossLane = profiles.get(encounterRows.lanes.boss), thrallLane = profiles.get(encounterRows.lanes.add);
  if (bossLane === undefined || thrallLane === undefined) throw new Error('Missing declared roaming lanes');
  const lane = new ProjectionLane(scene, new THREE.Color(...rows.colours.tell), bossLane, ctx.reach);
  const addLanes = Array.from({ length: encounterRows.lanes.count }, () => new ProjectionLane(scene, new THREE.Color(...rows.colours.wave), thrallLane, ctx.reach));
  const C = encounterRows.profile.fight.origin, R = rows.wall.radius;
  const cues = CueDirector.entered(context,rows.presentation);
  if (cues === undefined) throw new Error('Missing declared roaming presentation');
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
  let look: BossSocketRig | null = null, rowBody: Animal | null = null;
  /** A page's own room comes off its fight. */
  const heardRoom: HeardRoom = { sealK: 0, darkK: 0, glow: 0, open: 0, hung: true, won: false, focus: new THREE.Vector3() }, ember = { darkK: (): number => heardRoom.darkK }, hazardFrom = new THREE.Vector3();
  /** A page on a server has no body of its own: the rig goes on the row's, as the fight says it, and comes off when the row goes. */
  const rigView = (): void => {
    if (rowBody !== null && !ctx.animals.animals.includes(rowBody)) { look?.dispose(); look = null; rowBody = null; }
    rowBody ??= ctx.animals.animals.find(body => body.rowDriven && body.kind === encounterRows.kind) ?? null;
    if (rowBody === null) return;
    look ??= bindBossSocketRig(context.scope, rows.socketRig.id, rowBody);
    look.setGlow(heardRoom.glow); look.setHazardsHung(heardRoom.hung);
  };
  const struckView = (point: THREE.Vector3, dir: THREE.Vector3): void => {
    cues.cue(rows.events.hit, point, dir); wirePage.drew('struck');
    if (look !== null && point.distanceTo(look.focusWorld(_v)) < look.focusRadius) cues.cue(heardRoom.open > 0.5 ? rows.events.open : rows.events.shut, point, dir);
  };
  const lightView = (on: boolean): void => {
    if (on) light ??= wirePage.on ? pool.borrow(rows.light.colour, 0, rows.light.distance, rows.light.decay) : pool.acquire(rows.light.colour, 0, rows.light.distance, rows.light.decay);
    else if (light) { pool.release(light); light = null; }
  };
  const hazardView: ProjectionViews['views']['hazard'] = (i, f, t, event) => {
    const view = fallen[i]; if (view === undefined) return;
    if (event === 'drop') { if (look === null) view.from.copy(hazardFrom); else look.hazardWorld(i, view.from); view.group.visible = true; view.group.position.copy(view.from); }
    else if (event === 'fall' || event === 'land') {
      const u = f.fallT, from = view.from;
      view.group.position.set(from.x + (f.x - from.x) * u, from.y + (f.y + rows.hazard.landingLift - from.y) * u * u + Math.sin(u * Math.PI) * rows.hazard.arc, from.z + (f.z - from.z) * u);
      view.group.rotation.set(u * rows.hazard.rotation[0], u * rows.hazard.rotation[1], u * rows.hazard.rotation[2]);
      if (event === 'land') { ctx.shot(rows.landSound, _v.set(f.x, f.y, f.z)); cues.cue(rows.events.land, _v, _w.set(0, 1, 0)); }
    } else if (event === 'burn') {
      const dark = ember.darkK(), glow = dark > 0 ? 1 - rows.hazard.dark * dark : 1;
      view.flame.visible = true; view.flame.position.set(f.x, f.y, f.z);
      setLentParam(rows.hazard.look, rows.hazard.alpha, rows.hazard.alphaBase * glow);
      view.ring.setTime(t);
      view.ring.ring(f.x, f.z, rows.hazard.radius, (rows.hazard.pulse[0] + rows.hazard.pulse[1] * Math.sin(t * rows.hazard.pulse[2] + f.x)) * glow, rows.hazard.width);
    } else if (event === 'placed') { view.group.visible = true; view.group.position.set(f.x, f.y + rows.hazard.landingLift, f.z); view.group.rotation.set(rows.hazard.rotation[0], i, rows.hazard.rotation[2]); }
    else { view.group.visible = false; view.flame.visible = false; view.ring.hide(); }
  };
  const ringView: ProjectionViews['views']['ring'] = (i, t, at) => {
    const w = waves[i]; if (w === undefined) return;
    if (at === null) w.g.hide(); else { w.g.setTime(t); w.g.ring(at.x, at.z, w.r, 0.95, 0.25); }
  };
  const park = (a: Animal): void => {
    a.hidden = true; a.mesh.visible = false;
    const i = ctx.animals.animals.indexOf(a); if (i !== -1) ctx.animals.animals.splice(i, 1);
  };
  const fight: ProjectionFight = createProjectionFight(ctx, {
    groundAt: heightAt,
    body: {
      make: () => {
        const a = bodyOwner.spawn(); if (a === null) throw new Error('Missing native roaming boss body');
        pinBrain(a);
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
      light: lightView,
      action: (k, move) => { k.mem[encounterRows.actionField] = actions.get(move) ?? 0; }, roar: k => { ctx.animals.onSound?.(rows.roar, k.position); },
      burst: k => { cues.cue(rows.events.burst, k.position, _w.set(0, 1, 0)); },
      hazard: hazardView,
      add: (a, event) => {
        if (event === 'in') puffs.burst(_v.set(a.position.x, heightAt(a.position.x, a.position.z) + rows.puffs.lift, a.position.z), ...rows.puffs.enter);
        else puffs.burst(_v.copy(a.position).setY(a.position.y + rows.puffs.lift), ...rows.puffs.leave);
      },
      ring: ringView,
      tell: tellRing,
    },
  }, source.identity.seed, program, decisions, encounterRows);
  const air = wirePage.on ? heardRoom : fight;
  if (!wirePage.on) ember.darkK = () => fight.darkK;

  /** the fog wall, the puffs, the ribcage's opening and the fight's light, every frame (I–II: the ribcage's amber on the
   *  stones; III: your lantern) */
  // PF5: the wall's look params are written when they change (outside a fight, never: every frame wrote the same values)
  let wallSeal = Number.NaN; const wallFog = new THREE.Color(-1, -1, -1);
  function room(dt: number, t: number): void {
    const seal = rows.wall.seal * air.sealK, fog = scene.fog;
    if (seal !== wallSeal) { wallSeal = seal; setLentParam(rows.wall.look, rows.wall.alpha, seal); }
    wall.visible = seal > rows.wall.visible;
    if (fog instanceof THREE.Fog && !fog.color.equals(wallFog)) {
      wallFog.copy(fog.color); setLentParam(rows.wall.look, rows.wall.colour, _col.copy(fog.color).multiplyScalar(rows.wall.colourGain).toArray(_fog));
    }
    puffs.update(dt, t);
    if (!wirePage.on) {
      if (fight.body === null || look === null) return;
      look.setOpen(Math.max(fight.open, 0.35 * fight.darkK), t);
    } else look?.setOpen(Math.max(heardRoom.open, 0.35 * heardRoom.darkK), t);
    if (!light) return;
    if (air.darkK > rows.light.darkness) {
      const c = ctx.game.camera.position;
      light.position.set(c.x, c.y + rows.light.playerAbove, c.z); light.color.fromArray(rows.light.playerColour); light.distance = rows.light.playerDistance; light.intensity = rows.light.playerGain * air.darkK;
    } else {
      if (look === null) light.position.copy(heardRoom.focus); else look.focusWorld(light.position);
      light.position.y += rows.light.focusAbove; light.color.fromArray(rows.light.focusColour); light.distance = rows.light.focusDistance;
      light.intensity = air.won ? 0 : rows.light.focusGain * air.glow * (rows.light.focusOpen[0] + rows.light.focusOpen[1] * air.open);
    }
  }

  const dimFog = new Dim(), dimHemi = new Dim(), dimEnv = new Dim(), dimLights: Dim[] = [], dimDome = [new Dim(), new Dim()];
  const fogCol = new THREE.Color(), fogLast = new THREE.Color(-1, -1, -1);
  /** the fog closing (the seal) and the Last Light's dark, scaled on top of what the sky set this frame */
  const atmosphere = (): void => {
    const { sealK: seal, darkK: dark } = air;
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

  if (wirePage.on) followRoamingFight(context, { rows, ring: ringView, hazard: hazardView, cues, lane, addLanes, tellRing, puffs, waves, heardRoom, hazardFrom, room, sound: at => { ctx.animals.onSound?.(rows.roar, at); }, light: lightView, rig: rigView, struck: struckView });
  const victory = fight.victory.bind(fight);
  fight.victory = () => { victory(); look?.setOpen(0, 0); };
  installEnteredRuntimeService(context, scope => {
    const descriptor = Object.getOwnPropertyDescriptor(scene, 'onBeforeRender'), previous = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args) => { atmosphere(); previous(...args); };
    scope.onDispose(() => { if (descriptor === undefined) Reflect.deleteProperty(scene, 'onBeforeRender'); else Object.defineProperty(scene, 'onBeforeRender', descriptor); });
  });
  if (!ctx.animals.herdless) { // a page on a server has no body of its own to warm
    const k = fight.spawn();
    if (TIER_CONFIG.furShells) { k.setShellLevel(rows.fur.prewarm); k.setShellLevel(rows.fur.parked); }
    fight.present = true; fight.setPresent(false);
    for (const row of rows.prewarm) park(ctx.animals.spawn(row.kind, C.x, C.z, 0, row.variant));
  } else if (light !== null) { pool.release(light); light = null; } // as `setPresent(false)` returns it: held, no fight lights it, and the next light asked for makes the level one more, which rebuilds every lit program (DL10: Pine 61 / 107)
  context.scope.onDispose(() => {
    disposeTell(tellRing); for (const wave of waves) disposeTell(wave.g); for (const hazard of fallen) disposeTell(hazard.ring);
    lane.dispose(); for (const add of addLanes) add.dispose(); puffs.dispose();
    if (light !== null) { pool.release(light); light = null; } look?.dispose(); wall.removeFromParent(); wall.geometry.dispose(); });
  return fight;
}
