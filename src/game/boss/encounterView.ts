/** Client-only encounter views (the boss fight host, G474): a slot encounter's cues and telegraph on the cue director
 * and ground tells, and a patrol's looks, figures, arrows and cues. The law stays in `encounterPatrol`; no shard renderer
 * callback is accepted. Never imported by renderer-free hosts. */
import * as THREE from 'three';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { pinBrain } from '@wildshard/engine/ai/inspect';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { Projectiles, type ProjectileWorld } from '@wildshard/engine/combat/view/projectile';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { CueDirector } from '../audio/cueDirector';
import { GroundTell } from '../Elite';
import type { ReturnProgram } from '../population/returnProgram';
import { EncounterPatrol, EncounterSchedule, EncounterSlots, type EncounterSlotSite, type PatrolActorBinding, type PatrolActorRoster, type PatrolMember, type SlotActor } from './encounterPatrol';

const finite = v.pipe(v.number(), v.finite()), cue = v.pipe(v.string(), v.regex(/^cue\.[a-zA-Z0-9.-]+$/u)), name = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u));
const shader = v.pipe(v.string(), v.maxLength(4096));
/**
 * What a slot encounter shows (the cycle's `wake` / `dawn` flags spawn into and release the sites): `cues` at a site as an
 * actor wakes, on a hit (`weak` where the guest finds a weak point, `hard` past `drop` hp), on the member's `broken` flag
 * and as the actor's `strike` memory field turns 1 (then 2), `ahead` × the tell's reach in front; `trails` every `every` s
 * while a memory field is in [min, max), with `chance`; `lift` raises each point (the body's × the actor's scale). The
 * `tell` wedge (its own shaders: uniforms uFill, uAlpha, uColor) fills through the attack's `wind` and shows until
 * `strike` + `hold`, alpha `alpha[0] + alpha[1] × fill`, then `alpha[2]` on the blow.
 */
export const SlotViewSchema = v.strictObject({
  cycle: v.strictObject({ wake: name, dawn: name }), states: v.strictObject({ broken: name, retire: name, home: name }),
  cues: v.strictObject({ wake: cue, hit: cue, weak: cue, hard: v.strictObject({ cue, drop: finite }), broken: cue, strike: cue }),
  lift: v.strictObject({ wake: finite, hit: finite, broken: finite, strike: finite }), strike: v.strictObject({ field: name, ahead: finite }),
  every: v.pipe(finite, v.minValue(0.01)),
  trails: v.pipe(v.array(v.strictObject({ cue, field: name, min: finite, max: finite, chance: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    at: v.picklist(['ground', 'body']), lift: finite })), v.maxLength(8)),
  tell: v.strictObject({ pool: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)), cone: finite, reach: finite, wind: finite, strike: finite, hold: finite,
    alpha: v.tuple([finite, finite, finite]), colour: v.tuple([finite, finite, finite]), vertexShader: shader, fragmentShader: shader }),
});
/** A slot actor as drawn: where it stands and faces, its health and its attack's phase (−1 between attacks). */
export interface SlotViewActor extends SlotActor { readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly yaw: number; readonly hp: number; readonly attackPhase: number }
/** A site whose actor woke (`awake` 1: hide it) or is home again (0: stand it back up), for the caller's own sites. */
export interface SlotSiteChange { readonly index: number; readonly awake: number }
interface Awake<A> { readonly a: A; readonly site: number; lastHp: number; readonly wedge: GroundTell }
const point = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** A slot encounter on its sites, drawn from rows: the roster's law stays in `EncounterSlots`, the look in cue rows; the
 * sites' own show and hide is the caller's, from the changes `update` returns. */
export class SlotEncounterView<A extends SlotViewActor = Animal> {
  readonly slots: EncounterSlots<A>;
  readonly awake: Awake<A>[] = [];
  private readonly changes: SlotSiteChange[] = [];
  private readonly rows: v.InferOutput<typeof SlotViewSchema>;
  private readonly wedges: GroundTell[] = [];
  private trailT = 0;
  constructor(slots: unknown, view: unknown, program: ReturnProgram, private readonly ports: { readonly scene: THREE.Scene; readonly cues: CueDirector;
    readonly sites: readonly EncounterSlotSite[] | null; readonly guest: { readonly weakPoint: (actor: A, at: THREE.Vector3) => boolean } }) {
    this.slots = new EncounterSlots<A>(slots, program); this.rows = v.parse(SlotViewSchema, view);
    const tell = this.rows.tell;
    for (let i = 0; i < tell.pool; i++) {
      const fill = { value: 0 }, alpha = { value: 0 };
      const material = new THREE.ShaderMaterial({ vertexShader: tell.vertexShader, fragmentShader: tell.fragmentShader,
        uniforms: { uFill: fill, uAlpha: alpha, uColor: { value: new THREE.Color(...tell.colour) } }, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.wedges.push(new GroundTell(ports.scene, 'wedge', 0, { cone: tell.cone, material, fill, alpha }));
    }
  }
  attachActors(roster: PatrolActorRoster<A>): void { this.slots.attachActors(roster); }
  /** Wake the chosen sites (the cycle's own choice when `which` is omitted); the changes until the next `update`. */
  wake(which?: readonly number[]): readonly SlotSiteChange[] {
    const sites = this.ports.sites; if (sites === null) return this.changes;
    for (const { a, index } of this.slots.spawnActors(sites, which)) {
      const site = sites[index], wedge = this.wedges[this.awake.length % this.wedges.length];
      if (site === undefined || wedge === undefined) continue;
      this.changes.push({ index, awake: 1 }); this.awake.push({ a, site: index, lastHp: a.hp, wedge });
      this.ports.cues.cue(this.rows.cues.wake, point.set(site.x, heightAt(site.x, site.z) + this.rows.lift.wake, site.z), UP);
    }
    return this.changes;
  }
  /** Send every actor home; a site whose actor is already gone stands again. */
  dawn(): readonly SlotSiteChange[] { for (const index of this.slots.dawnActors()) this.changes.push({ index, awake: 0 }); return this.changes; }
  /** Step the roster and draw it; the sites to hide or show since the last call. */
  update(dt: number, frame: Readonly<Record<string, number>>): readonly SlotSiteChange[] {
    this.changes.length = 0;
    const rows = this.rows, cues = this.ports.cues, step = this.slots.updateActors(dt, frame);
    if (step.cycle[rows.cycle.wake] === 1) this.wake();
    if (step.cycle[rows.cycle.dawn] === 1) this.dawn();
    for (const row of step.released) { const index = row['index']; if (index !== undefined) this.changes.push({ index, awake: 0 }); }
    this.trailT += dt; const trail = this.trailT > rows.every; if (trail) this.trailT = 0;
    for (let i = this.awake.length - 1; i >= 0; i--) {
      const w = this.awake[i]; if (w === undefined) continue;
      const a = w.a, sc = a.scale, state = step.members.get(a.entityId) ?? {};
      if (a.hp < w.lastHp) {
        point.set(a.position.x, a.position.y + rows.lift.hit * sc, a.position.z);
        cues.cue(this.ports.guest.weakPoint(a, point) ? rows.cues.weak : a.hp < w.lastHp - rows.cues.hard.drop ? rows.cues.hard.cue : rows.cues.hit, point, UP);
        w.lastHp = a.hp;
      }
      if (!a.alive) {
        w.wedge.hide();
        if (state[rows.states.broken] === 1) cues.cue(rows.cues.broken, point.set(a.position.x, a.position.y + rows.lift.broken * sc, a.position.z), UP);
        if (state[rows.states.retire] === 1) { this.slots.retireActor(a, true); this.awake.splice(i, 1); }
        continue;
      }
      if (state[rows.states.home] === 1) { this.slots.retireActor(a, false); this.changes.push({ index: w.site, awake: 0 }); this.awake.splice(i, 1); continue; }
      if (trail) for (const row of rows.trails) {
        const value = a.mem[row.field] ?? 0;
        if (value < row.min || value >= row.max || (row.chance < 1 && app.rng.stream('cosmetic').next() >= row.chance)) continue;
        cues.cue(row.cue, point.set(a.position.x, row.at === 'ground' ? heightAt(a.position.x, a.position.z) + row.lift : a.position.y + row.lift * sc, a.position.z), UP);
      }
      const p = a.attackPhase, tell = rows.tell, reach = tell.reach * sc;
      if (p < 0) { w.wedge.hide(); continue; }
      if (p < tell.strike + tell.hold) w.wedge.wedge(a.position.x, a.position.z, a.yaw, reach, Math.min(1, p / tell.wind), p < tell.strike ? tell.alpha[0] + tell.alpha[1] * (p / tell.wind) : tell.alpha[2]);
      else w.wedge.hide();
      if (a.mem[rows.strike.field] === 1) {
        a.mem[rows.strike.field] = 2;
        point.set(a.position.x + Math.sin(a.yaw) * reach * rows.strike.ahead, 0, a.position.z + Math.cos(a.yaw) * reach * rows.strike.ahead);
        cues.cue(rows.cues.strike, point.setY(heightAt(point.x, point.z) + rows.lift.strike), UP);
      }
    }
    return this.changes;
  }
}

const vector = v.tuple([finite, finite, finite]);
const look = v.strictObject({ key: v.pipe(v.string(), v.maxLength(64)), common: shader, fragment: shader });
/**
 * What a patrol shows: each actor's `looks` (keyed by variant, or `quiet` for a quiet spawn, which also grows by
 * `quietScale`): a self-lit additive patch on its own material (uniforms uGFade, the member's `fade` state, and uGTime) and
 * on a figure mesh the caller supplies per look, hung on the rig's `bone`; the cues where it forms (`lift` over the ground),
 * where it tears apart while `dying`, behind its gallop (`trail`: `rate` a second, `back` m behind the `seat`), as it looses
 * (`aim` signal, from `lift` over the seat) and where its arrows hit you or the world; and `targets`, spheres in the bone's
 * frame (radius × scale) that a ray may hit before the body's own capsules.
 */
export const PatrolViewSchema = v.strictObject({
  looks: v.record(name, look), quietLook: name, quietScale: v.pipe(finite, v.minValue(0.1)), figure: v.strictObject({ bone: name }), seat: vector,
  states: v.strictObject({ fade: name, dying: name, dead: name }),
  cues: v.strictObject({ form: cue, tear: cue, loose: cue, hurt: cue, impact: cue }), lift: v.strictObject({ form: finite, loose: finite }),
  trail: v.strictObject({ cue, rate: v.pipe(finite, v.minValue(0)), back: finite }), aim: name, damage: v.pipe(finite, v.minValue(0)),
  targets: v.pipe(v.array(v.strictObject({ at: vector, radius: v.pipe(finite, v.minValue(0)), head: v.boolean() })), v.maxLength(4)),
  arrow: v.strictObject({ geometry: v.unknown(), colour: vector, renderOrder: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    length: finite, gravity: finite, drag: finite, windCoupling: finite, bury: finite, recover: finite,
    maxFlying: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(64)), maxStuck: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    stick: v.boolean(), hitsAnimals: v.boolean(), puffs: v.boolean(), hurtsPlayer: v.strictObject({ radius: finite, height: finite }) }),
});
/** A patrol actor as drawn: its skinned body, scale, variant and facing; a target the player's shots can strike. */
export interface PatrolViewActor extends TargetAnimal { readonly entityId: string; readonly mem: Record<string, number>; readonly hidden: boolean; herd: number;
  readonly mesh: THREE.SkinnedMesh; scale: number; readonly variant: string; readonly yaw: number }
/** An arrow that struck the player this step: its damage and who loosed it. */
export interface PatrolHit<A> { readonly damage: number; readonly from: A | null }
interface Rider<A> { readonly a: A; readonly scope: Scope; readonly fades: THREE.IUniform<number>[]; readonly law: PatrolMember; readonly bone: THREE.Object3D }
const seat = new THREE.Vector3(), back = new THREE.Vector3(), aimed = new THREE.Vector3(), ray = new THREE.Ray(), sphere = new THREE.Sphere(), crossing = new THREE.Vector3();

/** A patrol encounter drawn from rows: `EncounterPatrol` owns the law and `EncounterSchedule` the motion; this draws them. */
export class PatrolEncounterView<A extends PatrolViewActor = Animal> {
  readonly riders: Rider<A>[] = [];
  readonly patrol: EncounterPatrol<A>;
  readonly arrows: Projectiles;
  private readonly rows: v.InferOutput<typeof PatrolViewSchema>;
  private readonly motion: EncounterSchedule;
  private readonly time: THREE.IUniform<number> = { value: 0 };
  private readonly hits: PatrolHit<A>[] = [];
  private readonly hit: TargetHit;
  private shooter: A | null = null;
  get killsTonight(): number { return this.patrol.kills; }
  constructor(input: { readonly patrol: unknown; readonly motion: unknown; readonly view: unknown }, private readonly program: ReturnProgram,
    private readonly ports: ProjectileWorld & { readonly cues: CueDirector; readonly figures: Readonly<Record<string, THREE.BufferGeometry>> }) {
    this.rows = v.parse(PatrolViewSchema, input.view);
    this.patrol = new EncounterPatrol<A>(input.patrol, program, app.rng.stream('ai')); this.motion = new EncounterSchedule(input.motion, program);
    for (const key of Object.keys(this.rows.looks)) if (ports.figures[key] === undefined) throw new Error(`Missing patrol figure: ${key}`);
    const { geometry, colour, renderOrder, ...kind } = this.rows.arrow;
    this.arrows = new Projectiles(ports, undefined, { ...kind, geometry: new THREE.BufferGeometryLoader().parse(geometry),
      material: new THREE.MeshBasicMaterial({ color: new THREE.Color(...colour), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, toneMapped: false, fog: false }) });
    this.arrows.mesh.renderOrder = renderOrder; this.arrows.mesh.receiveShadow = false;
    this.arrows.onPlayerHit = at => { this.hits.push({ damage: this.rows.damage, from: this.shooter }); ports.cues.cue(this.rows.cues.hurt, at, UP); };
    this.arrows.onImpact = (_surface, at) => { ports.cues.cue(this.rows.cues.impact, at, UP); };
    this.hit = { animal: { kind: '', position: new THREE.Vector3(), alive: false, applyDamage: () => false, damageFor: () => 0 }, point: new THREE.Vector3(), distance: 0, headshot: false };
  }
  attachActors(roster: PatrolActorRoster<A>): void { this.patrol.attachActors(roster); }
  /** One actor at (x, z) facing `yaw`, outside any line (drive its steering memory); `quiet` takes the quiet look. */
  spawnRider(at: { readonly x: number; readonly z: number; readonly yaw: number; readonly variant?: string; readonly quiet?: boolean }): A | null {
    const bound = this.patrol.spawnActor({ x: at.x, z: at.z, yaw: at.yaw, ...(at.variant === undefined ? {} : { variant: at.variant }), quiet: Number(at.quiet === true) });
    return bound === null ? null : this.present(bound, at.quiet === true);
  }
  /** A line of `count` from `at` (m along the route; default the farthest from the player), `captain` at its head. */
  spawnLine(at: { readonly count?: number; readonly captain?: boolean; readonly at?: number } = {}): A[] {
    return this.patrol.spawnActors(this.ports.player.position, { ...at, leader: at.captain === true }).map(bound => this.present(bound, false));
  }
  dissolve(actor: A): void { this.patrol.dissolveActor(actor); }
  dawn(): void { for (const r of this.riders) this.dissolve(r.a); }
  private present(bound: PatrolActorBinding<A>, quiet: boolean): A {
    const { a, law } = bound, rows = this.rows, key = quiet ? rows.quietLook : rows.looks[a.variant] === undefined ? Object.keys(rows.looks)[0] ?? '' : a.variant;
    const patch = rows.looks[key], figure = this.ports.figures[key], bone = a.mesh.skeleton.getBoneByName(rows.figure.bone);
    if (patch === undefined || figure === undefined || bone === undefined) throw new Error(`Patrol look ${key} needs its style, figure and bone`);
    const scope = this.ports.game.levelScope.child('patrol-actor'), fades: THREE.IUniform<number>[] = [];
    const material = (): THREE.MeshLambertMaterial => {
      const fade: THREE.IUniform<number> = { value: 0 }; fades.push(fade);
      const made = scope.own(new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      patchShader(made, 'encounter.look', PATCH_ORDER.decorate, shaderRows => {
        shaderRows.uniforms['uGFade'] = fade; shaderRows.uniforms['uGTime'] = this.time;
        shaderRows.fragmentShader = shaderRows.fragmentShader.replace('#include <common>', patch.common).replace('#include <dithering_fragment>', patch.fragment);
      }, { key: patch.key });
      made.name = patch.key; return made;
    };
    if (quiet) { a.scale *= rows.quietScale; a.mesh.scale.setScalar(a.scale); pinBrain(a, scope); }
    a.mesh.material = material();
    // a ghost casts no shadow: the roster sets castShadow every frame, so it stays pinned off
    Object.defineProperty(a.mesh, 'castShadow', { get: () => false, set: () => undefined, configurable: true });
    const mesh = new THREE.Mesh(figure, material()); mesh.name = `${patch.key}-figure`; mesh.frustumCulled = false; bone.add(mesh);
    this.riders.push({ a, scope, fades, law, bone });
    this.ports.cues.cue(rows.cues.form, seat.set(a.position.x, heightAt(a.position.x, a.position.z) + rows.lift.form, a.position.z), UP);
    return a;
  }
  /** The nearest of the drawn targets along the ray, if nearer than `hit` (the body's own capsules). */
  target(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    let best = hit === null ? maxDist : Math.min(maxDist, hit.distance), found: A | null = null, head = false;
    ray.set(origin, dir);
    for (const r of this.riders) {
      if (r.law.state[this.rows.states.dead] === 1 || !r.a.alive || r.a.hidden || r.a.position.distanceToSquared(origin) > (best + 4) * (best + 4)) continue;
      for (const row of this.rows.targets) {
        sphere.set(sphere.center.set(...row.at).applyMatrix4(r.bone.matrixWorld), row.radius * r.a.scale);
        if (ray.intersectSphere(sphere, crossing) === null) continue;
        const d = crossing.distanceTo(origin);
        if (d < best) { best = d; found = r.a; head = row.head; this.hit.point.copy(crossing); }
      }
    }
    if (found === null) return hit;
    this.hit.animal = found; this.hit.distance = best; this.hit.headshot = head;
    return this.hit;
  }
  /** Step the patrol and draw it (`frame`: its own fields beside the player's px / py / pz); the arrows that struck the
   *  player since the last call. `freeze` holds every actor where it stands. */
  update(dt: number, t: number, frame: Readonly<Record<string, number>>, freeze = false): readonly PatrolHit<A>[] {
    this.hits.length = 0; this.time.value = t;
    const rows = this.rows, cues = this.ports.cues, p = this.ports.player.position;
    const step = this.patrol.updateActors(dt, { ...frame, px: p.x, py: p.y, pz: p.z }, freeze);
    if (step.dt > 0) this.motion.project({ dt: step.dt, px: p.x, pz: p.z });
    if (step.spawn) this.spawnLine();
    const effects = new Map(step.effects.map(effect => [effect.member.id, effect]));
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i]; if (r === undefined) continue;
      const a = r.a, effect = effects.get(r.law.id), state = r.law.state;
      if (effect?.retire === true) { this.patrol.retireActor(a); r.scope.dispose(); this.riders.splice(i, 1); continue; }
      for (const fade of r.fades) fade.value = state[rows.states.fade] ?? 0;
      if ((state[rows.states.dying] ?? 0) > 0) cues.cue(rows.cues.tear, this.seat(r), UP);
      if (state[rows.states.dead] === 1 || a.hidden) continue;
      if (app.rng.stream('cosmetic').next() < dt * rows.trail.rate) {
        back.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        cues.cue(rows.trail.cue, this.seat(r).addScaledVector(back, rows.trail.back), back);
      }
      if (!freeze && effect?.shoot === true) this.shoot(r);
    }
    this.arrows.update(dt);
    return this.hits;
  }
  private seat(r: Rider<A>): THREE.Vector3 { return seat.set(...this.rows.seat).applyMatrix4(r.bone.matrixWorld); }
  /** One arrow at the player: the `aim` signal's lead and spread from the rider's shoulders. */
  private shoot(r: Rider<A>): void {
    const p = this.ports.player.position, from = this.seat(r); from.y += this.rows.lift.loose * r.a.scale;
    const aim = this.program.project(this.rows.aim, { x: from.x, y: from.y, z: from.z, px: p.x, py: p.y, pz: p.z, vx: this.motion.value('vx'), vz: this.motion.value('vz') }, app.rng.stream('ai'));
    this.shooter = r.a;
    this.arrows.launch(from, aimed.set(aim['dx'] ?? 0, aim['dy'] ?? 0, aim['dz'] ?? 0), { damageScale: 1 });
    this.ports.cues.cue(this.rows.cues.loose, from, UP);
  }
}
