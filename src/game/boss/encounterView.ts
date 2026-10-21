/** Client-only encounter views (the boss fight host, G474): a slot encounter's cues and telegraph on the cue director
 * and ground tells, a patrol's looks, figures, arrows and cues, and a boss's cloud body. The law stays in
 * existing AS projections and the fight; no shard renderer callback is accepted. Never imported by renderer-free hosts. */
import * as THREE from 'three';
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { pinBrain } from '@wildshard/engine/ai/pinning';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { Projectiles, type ProjectileWorld } from '@wildshard/engine/combat/view/projectile';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { FX, fxMaterial, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { modelPoseMatrix } from '@wildshard/engine/models/placementBatch';
import { boxDesc, type WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { SpecimenAssetSchema } from '@wildshard/format/specimenCatalogue';
import { replaceSpecimenInstances } from '../models/specimenCatalogue';
import type { CueDirector } from '../audio/cueDirector';
import { GroundTell } from '../Elite';
import { LightningStrip } from '../weapons/arcPower';
import { ProjectedState, type ReturnProgram } from '../population/returnProgram';
import { createClientScene } from '../plugin/ui';
import { installChannelPrograms } from '../plugin/channelPrograms';
import { lentLook, setLentParam } from '../shardfile/lentLooks';
import type { EncounterSlotsRows,EncounterPatrolRows,EncounterScheduleRows,SlotViewRows,PatrolViewRows,CloudBodyRows,ArenaSceneRows,EncounterMaterialRows } from '@wildshard/format/encounterRows';

const finite = v.pipe(v.number(), v.finite());
/**
 * What a slot encounter shows (the cycle's `wake` / `dawn` flags spawn into and release the sites): `cues` at a site as an
 * actor wakes, on a hit (`weak` where the guest finds a weak point, `hard` past `drop` hp), on the member's `broken` flag
 * and as the actor's `strike` memory field turns 1 (then 2), `ahead` × the tell's reach in front; `trails` every `every` s
 * while a memory field is in [min, max), with `chance`; `lift` raises each point (the body's × the actor's scale). The
 * `tell` wedge (its own shaders: uniforms uFill, uAlpha, uColor) fills through the attack's `wind` and shows until
 * `strike` + `hold`, alpha `alpha[0] + alpha[1] × fill`, then `alpha[2]` on the blow.
 */
/** A slot actor as drawn: where it stands and faces, its health and its attack's phase (−1 between attacks). */
export interface SlotViewActor extends PatrolActor { readonly scale:number; yOffset:number; readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly yaw: number; readonly hp: number; readonly attackPhase: number }
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
/**
 * The sites a slot encounter wakes from (`name`'s statues): one instanced copy of the model's `variants[k]` at each
 * site (k: `variantCycle[i mod its length]`; `sink` × scale into the ground, leaning `tilt`), all wearing the `generated`
 * asset once it loads, and each its
 * own `collider` box piece (half width, half depth, top and bottom × scale; `label`, `surface`, from `file`) that stops
 * colliding while the site is awake.
 */
export const EncounterSitesSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), label: v.string(), file: v.string(), surface: v.picklist(['stone', 'wood', 'metal', 'earth', 'ground']),
  variants: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(8)), variantCycle: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0))), v.minLength(1), v.maxLength(16)),
  sink: finite, generated: SpecimenAssetSchema,
  collider: v.strictObject({ hw: finite, hd: finite, top: finite, bottom: finite }),
  sites: v.pipe(v.array(v.strictObject({ x: finite, z: finite, yaw: finite, scale: finite, tilt: v.optional(finite, 0) })), v.maxLength(256)),
});
/** A placed site: where it stands and the copy that draws it. */
export interface EncounterSite { readonly x:number; readonly z:number; readonly yaw:number; readonly variant:number; readonly y: number; readonly scale: number; readonly tilt: number; readonly slot: number;
  readonly collider: { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number; ghost: true } }
/** A slot encounter's sites on the ground: drawn instanced, solid while they stand, hidden while their actor is out. */
export class EncounterSites {
  readonly sites: EncounterSite[] = [];
  readonly object = new THREE.Group();
  private readonly rows: v.InferOutput<typeof EncounterSitesSchema>;
  private readonly awake: boolean[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  constructor(input: unknown) {
    const rows = this.rows = v.parse(EncounterSitesSchema, input), counts = rows.variants.map(() => 0), c = rows.collider;
    this.object.name = rows.name;
    for (const [i, s] of rows.sites.entries()) {
      const variant = rows.variantCycle[i % rows.variantCycle.length] ?? 0;
      if (rows.variants[variant] === undefined) throw new Error(`Encounter site has no variant ${String(variant)}`);
      const slot = counts[variant] ?? 0, y = heightAt(s.x, s.z) - rows.sink * s.scale; counts[variant] = slot + 1;
      this.sites.push({ x: s.x, y, z: s.z, yaw: s.yaw, scale: s.scale, tilt: s.tilt, variant, slot,
        collider: { x: s.x, z: s.z, hw: c.hw * s.scale, hd: c.hd * s.scale, rot: -s.yaw, yBottom: y - c.bottom, yTop: y + c.top * s.scale, ghost: true } });
    }
  }
  /** The sites' colliders as data (each is also its own registry piece once registered). */
  get colliders(): readonly EncounterSite['collider'][] { return this.sites.map(site => site.collider); }
  /** Place the model instanced at every site, wearing the generated asset when it lands. */
  place<P extends object>(model: ModelDef<P>, ctx: ModelContext, registry: WorldRegistry, sky: SkyRig): Placed {
    const placed = place(model, this.sites.map(s => ({ x: s.x, y: s.y, z: s.z, matrix: modelPoseMatrix({ x: s.x, y: s.y, z: s.z, yaw: s.yaw, scale: s.scale, roll: s.tilt }),
      variant: this.rows.variants[s.variant] ?? '' })), { ctx, draw: 'instanced', registry });
    this.object.add(placed.object);
    this.meshes = this.rows.variants.map(variant => {
      const key = `${model.id}:${variant}:0`, found: unknown = placed.object.name === key ? placed.object : placed.object.getObjectByName(key);
      return isInstances(found) ? found : new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0);
    });
    replaceSpecimenInstances(sky, this.rows.generated, this.meshes);
    return placed;
  }
  /** Each site its own piece, following the sites' group, solid only while it stands. */
  register(registry: WorldRegistry): void {
    this.object.updateWorldMatrix(true, false);
    this.sites.forEach((s, i) => {
      registry.add({ id: `${this.rows.name}-${String(i)}`, name: this.rows.label, category: 'props', file: this.rows.file, surface: this.rows.surface,
        follows: this.object, colliders: [boxDesc(s.collider)], active: () => this.awake[i] !== true });
    });
  }
  /** Apply a slot view's site changes. */
  apply(changes: readonly SlotSiteChange[]): void { for (const change of changes) this.setAwake(change.index, change.awake === 1); }
  isAwake(index: number): boolean { return this.awake[index] === true; }
  private setAwake(index: number, awake: boolean): void {
    const s = this.sites[index], mesh = this.meshes[s?.variant ?? -1];
    if (s === undefined || mesh === undefined || this.awake[index] === awake) return;
    this.awake[index] = awake;
    mesh.setMatrixAt(s.slot, awake ? hidden : modelPoseMatrix({ x: s.x, y: s.y, z: s.z, yaw: s.yaw, scale: s.scale, roll: s.tilt }));
    mesh.instanceMatrix.needsUpdate = true;
  }
}
/** A site whose actor woke (`awake` 1: hide it) or is home again (0: stand it back up), for the caller's own sites. */
export interface SlotSiteChange { readonly index: number; readonly awake: number }
interface Awake<A> { readonly a: A; readonly site: number; readonly law:ProjectedState; lastHp: number; readonly wedge: GroundTell }
const point = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** A slot encounter keeps one native body roster; existing AS owns its cycle and members; the
 * sites' own show and hide is the caller's, from the changes `update` returns. */
export class SlotEncounterView<A extends SlotViewActor = Animal> {
  private readonly cycle:ProjectedState;
  private readonly retired:number[]=[];
  private roster:PatrolActorRoster<A>|null=null;
  readonly awake: Awake<A>[] = [];
  private readonly changes: SlotSiteChange[] = [];
  private readonly rows: SlotViewRows;
  private readonly wedges: GroundTell[] = [];
  private trailT = 0;
  constructor(private readonly slots:EncounterSlotsRows, view: SlotViewRows, private readonly program:ReturnProgram, private readonly ports: { readonly scene: THREE.Scene; readonly cues: CueDirector;
    readonly sites: readonly Pick<EncounterSite,'x'|'z'|'yaw'|'variant'>[] | null; readonly guest: ReturnProgram }) {
    this.cycle=new ProjectedState({...slots.cycle,signals:{step:slots.cycle.signal}},program);this.rows=view;
    const tell = this.rows.tell;
    for (let i = 0; i < tell.pool; i++) {
      const fill = { value: 0 }, alpha = { value: 0 };
      const material = new THREE.ShaderMaterial({ vertexShader: tell.vertexShader, fragmentShader: tell.fragmentShader,
        uniforms: { uFill: fill, uAlpha: alpha, uColor: { value: new THREE.Color(...tell.colour) } }, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.wedges.push(new GroundTell(ports.scene, 'wedge', 0, { cone: tell.cone, material, fill, alpha }));
    }
  }
  attachActors(roster:PatrolActorRoster<A>):void {
    const rows=this.slots.actors;if(rows===undefined)throw new Error('Missing slot actor rows');
    for(const variant of new Set([rows.variant,...Object.values(rows.variants)]))roster.factory.model(rows.kind,variant);
    this.roster=roster;
  }
  /** Wake the chosen sites (the cycle's own choice when `which` is omitted); the changes until the next `update`. */
  wake(which?: readonly number[]): readonly SlotSiteChange[] {
    const sites=this.ports.sites,rows=this.slots.actors,roster=this.roster;if(sites===null||rows===undefined||roster===null)return this.changes;
    const selected=new Set<number>();
    if(which!==undefined)for(const index of which)selected.add(index);
    else for(let slot=0;slot<this.slots.select.count;slot++){
      const out=this.program.project(this.slots.select.signal,{...this.cycle.state,count:sites.length,night:this.cycle.state['t']??0,slot}),index=out['index'];
      if(index!==undefined){if(!Number.isSafeInteger(index)||index<0)throw new Error('Invalid encounter slot selection');selected.add(index);}
    }
    for(const index of selected){
      if(this.awake.length>=8||this.awake.some(row=>row.site===index))continue;
      const site=sites[index],wedge=this.wedges[this.awake.length%this.wedges.length];if(site===undefined||wedge===undefined)continue;
      const yaw=site.yaw+rows.yaw,a=roster.spawn(rows.kind,site.x,site.z,yaw,rows.variants[String(site.variant)]??rows.variant);
      a.herd=rows.herd;Object.assign(a.mem,rows.memory);a.mem[rows.home.x]=site.x;a.mem[rows.home.z]=site.z;a.mem[rows.home.yaw]=yaw;a.yOffset=rows.sink*a.scale;
      this.changes.push({index,awake:1});this.awake.push({a,site:index,lastHp:a.hp,wedge,law:new ProjectedState(this.slots.member,this.program)});
      this.ports.cues.cue(this.rows.cues.wake, point.set(site.x, heightAt(site.x, site.z) + this.rows.lift.wake, site.z), UP);
    }
    return this.changes;
  }
  /** Send every actor home; a site whose actor is already gone stands again. */
  dawn():readonly SlotSiteChange[]{
    const rows=this.slots.actors;if(rows===undefined)throw new Error('Missing slot actor rows');
    for(const {a,site}of this.awake){if(a.alive)a.mem[rows.dawn]=1;else if(a.hidden)this.changes.push({index:site,awake:0});}return this.changes;
  }
  private retire(index:number,delayed:boolean):void {
    const member=this.awake[index];if(member===undefined)return;
    this.roster?.retire(member.a);if(delayed)this.retired.push(member.site);this.awake.splice(index,1);
  }
  /** Step the roster and draw it; the sites to hide or show since the last call. */
  update(dt: number, frame: Readonly<Record<string, number>>): readonly SlotSiteChange[] {
    this.changes.length = 0;
    const rows=this.rows,cues=this.ports.cues,actors=this.slots.actors;if(actors===undefined)throw new Error('Missing slot actor rows');
    const step=this.cycle.step(this.roster===null?0:dt,frame),members=new Map<Awake<A>,Readonly<Record<string,number>>>();
    if(step.dt>0)for(const member of this.awake)members.set(member,member.law.project({dt:step.dt,alive:Number(member.a.alive),gone:member.a.mem[actors.gone]??0}));
    if(step.values[rows.cycle.wake]===1)this.wake();
    if(step.values[rows.cycle.dawn]===1)this.dawn();
    if(step.values[this.slots.release]===1){for(const index of this.retired)this.changes.push({index,awake:0});this.retired.length=0;}
    this.trailT += dt; const trail = this.trailT > rows.every; if (trail) this.trailT = 0;
    for (let i = this.awake.length - 1; i >= 0; i--) {
      const w = this.awake[i]; if (w === undefined) continue;
      const a = w.a, sc = a.scale, state = members.get(w) ?? {};
      if (a.hp < w.lastHp) {
        point.set(a.position.x, a.position.y + rows.lift.hit * sc, a.position.z);
        const weak=this.ports.guest.project('weakPoint',{x:a.position.x,ay:a.position.y,z:a.position.z,cos:Math.cos(-a.yaw),sin:Math.sin(-a.yaw),scale:a.scale,yOffset:a.yOffset,hitX:point.x,hitY:point.y,hitZ:point.z})['weakPoint']===1;
        cues.cue(weak ? rows.cues.weak : a.hp < w.lastHp - rows.cues.hard.drop ? rows.cues.hard.cue : rows.cues.hit, point, UP);
        w.lastHp = a.hp;
      }
      if (!a.alive) {
        w.wedge.hide();
        if (state[rows.states.broken] === 1) cues.cue(rows.cues.broken, point.set(a.position.x, a.position.y + rows.lift.broken * sc, a.position.z), UP);
        if (state[rows.states.retire] === 1) { this.retire(i,true); }
        continue;
      }
      if (state[rows.states.home] === 1) { this.retire(i,false); this.changes.push({ index: w.site, awake: 0 }); continue; }
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

/**
 * What a patrol shows: each actor's `looks` (keyed by variant, or `quiet` for a quiet spawn, which also grows by
 * `quietScale`): a self-lit additive patch on its own material (uniforms uGFade, the member's `fade` state, and uGTime) and
 * on a figure mesh the caller supplies per look, hung on the rig's `bone`; the cues where it forms (`lift` over the ground),
 * where it tears apart while `dying`, behind its gallop (`trail`: `rate` a second, `back` m behind the `seat`), as it looses
 * (`aim` signal, from `lift` over the seat) and where its arrows hit you or the world; and `targets`, spheres in the bone's
 * frame (radius × scale) that a ray may hit before the body's own capsules.
 */
/** Native bodies and allocation authority; neither supplies authored rules. */
interface PatrolActor { readonly entityId:string; readonly position:{readonly x:number;readonly z:number}; readonly mem:Record<string,number>; readonly alive:boolean; readonly hidden:boolean; herd:number }
interface PatrolActorRoster<A extends PatrolActor> { readonly factory:{model:(kind:string,variant:string)=>unknown}; spawn:(kind:string,x:number,z:number,yaw:number,variant:string)=>A; retire:(actor:A)=>void }
/** A patrol actor as drawn: its skinned body, scale, variant and facing; a target the player's shots can strike. */
export interface PatrolViewActor extends TargetAnimal { readonly entityId: string; readonly mem: Record<string, number>; readonly hidden: boolean; herd: number;
  readonly mesh: THREE.SkinnedMesh; scale: number; readonly variant: string; readonly yaw: number }
/** An arrow that struck the player this step: its damage and who loosed it. */
export interface PatrolHit<A> { readonly damage: number; readonly from: A | null }
interface Rider<A> { readonly a: A; readonly scope: Scope; readonly fades: THREE.IUniform<number>[]; readonly law:ProjectedState; readonly group:ProjectedState|null; readonly slot:number; readonly steering:Record<string,number>; readonly bone: THREE.Object3D }
const seat = new THREE.Vector3(), back = new THREE.Vector3(), aimed = new THREE.Vector3(), ray = new THREE.Ray(), sphere = new THREE.Sphere(), crossing = new THREE.Vector3();

/** One native patrol roster; existing AS projections own cycle, group and member decisions. */
export class PatrolEncounterView<A extends PatrolViewActor = Animal> {
  readonly riders: Rider<A>[] = [];
  private readonly cycle:ProjectedState;
  private readonly groups:ProjectedState[]=[];
  private roster:PatrolActorRoster<A>|null=null;
  private readonly random=app.rng.stream('ai');
  readonly arrows: Projectiles;
  private readonly rows: PatrolViewRows;
  private readonly motion: ProjectedState;
  private readonly time: THREE.IUniform<number> = { value: 0 };
  private readonly hits: PatrolHit<A>[] = [];
  private readonly hit: TargetHit;
  private shooter: A | null = null;
  get killsTonight(): number { return this.cycle.value('kills'); }
  private get living():number{return this.riders.filter(r=>r.law.state['dead']!==1).length;}
  constructor(private readonly input: { readonly patrol: EncounterPatrolRows; readonly motion: EncounterScheduleRows; readonly view: PatrolViewRows }, private readonly program: ReturnProgram,
    private readonly ports: ProjectileWorld & { readonly cues: CueDirector; readonly figures: Readonly<Record<string, THREE.BufferGeometry>> }) {
    this.rows = input.view;
    this.cycle=new ProjectedState({initial:{respawn:-1,phase:-1,kills:0},signals:{step:input.patrol.signals.cycle,empty:input.patrol.signals.empty}},program);this.motion=new ProjectedState(input.motion,program);
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
  attachActors(roster:PatrolActorRoster<A>):void{
    const rows=this.input.patrol.actors;if(rows===undefined)throw new Error('Missing patrol actor rows');
    roster.factory.model(rows.kind,rows.variant);this.roster=roster;
  }
  /** One actor at (x, z) facing `yaw`, outside any line (drive its steering memory); `quiet` takes the quiet look. */
  spawnRider(at: { readonly x: number; readonly z: number; readonly yaw: number; readonly variant?: string; readonly quiet?: boolean }): A | null {
    return this.spawn(at,null,0);
  }
  /** A line of `count` from `at` (m along the route; default the farthest from the player), `captain` at its head. */
  spawnLine(at: { readonly count?: number; readonly captain?: boolean; readonly at?: number } = {}): A[] {
    const rows=this.input.patrol,actors=rows.actors;if(actors===undefined||this.roster===null)return [];
    const count=at.count??actors.count;if(!Number.isSafeInteger(count)||count<0||count>8)throw new RangeError('Invalid patrol group size');
    const p=this.ports.player.position,start=this.program.project(rows.signals.start,{...rows.parameters,at:at.at??-1,px:p.x,pz:p.z},this.random);
    const group=new ProjectedState({initial:{...rows.group,...start},parameters:rows.parameters,signal:rows.signals.group},this.program);this.groups.push(group);
    const slots=Array.from({length:count},(_,slot)=>this.program.project(rows.signals.slot,{...rows.parameters,...group.state,slot}));
    return slots.flatMap((placement,slot)=>{const actor=this.spawn({x:placement['x']??0,z:placement['z']??0,yaw:placement['yaw']??0,variant:slot===0&&at.captain===true?actors.leader:actors.variant},group,slot);return actor===null?[]:[actor];});
  }
  dissolve(actor:A):void{this.riders.find(r=>r.a===actor)?.law.event('dissolve');}
  dawn(): void { for (const r of this.riders) this.dissolve(r.a); }
  private spawn(at:{readonly x:number;readonly z:number;readonly yaw:number;readonly variant?:string;readonly quiet?:boolean},group:ProjectedState|null,slot:number):A|null{
    const rows=this.input.patrol,actors=rows.actors;if(actors===undefined||this.roster===null)return null;
    const a=this.roster.spawn(actors.kind,at.x,at.z,at.yaw,at.variant??actors.variant);a.herd=actors.herd;
    if(this.riders.some(r=>r.a.entityId===a.entityId))throw new Error('Invalid patrol member');
    const law=new ProjectedState({initial:{...rows.member,quiet:Number(at.quiet===true),...this.program.project(rows.signals.retry,{first:1},this.random)},
      signals:{member:rows.signals.member,fire:rows.signals.fire,retry:rows.signals.retry,dissolve:rows.signals.dissolve}},this.program);
    return this.present(a,law,group,slot,at.quiet===true);
  }
  private present(a:A,law:ProjectedState,group:ProjectedState|null,slot:number,quiet:boolean):A {
    const rows=this.rows,key=quiet?rows.quietLook:rows.looks[a.variant]===undefined?Object.keys(rows.looks)[0]??'':a.variant;
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
    this.riders.push({a,scope,fades,law,bone,group,slot,steering:{}});
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
    const tick={...frame,px:p.x,py:p.y,pz:p.z},step=this.cycle.step(this.roster===null?0:dt,{...tick,living:this.living});
    const effects=new Map<Rider<A>,Readonly<Record<string,number>>>(),patrol=this.input.patrol,actors=patrol.actors;
    if(actors===undefined)throw new Error('Missing patrol actor rows');
    if(step.dt>0){
      if(step.values['dissolve']===1)this.dawn();
      for(const group of this.groups){
        const members=this.riders.filter(r=>r.group===group),lead=members.find(r=>r.law.state['dead']!==1);if(lead===undefined)continue;
        group.project({...tick,dt:step.dt,ax:lead.a.position.x,az:lead.a.position.z});
        for(const r of members){if(r.law.state['dead']===1)continue;const a=r.a,target=this.program.project(patrol.signals.target,{...patrol.parameters,...group.state,...tick,slot:r.slot,ax:a.position.x,az:a.position.z});
          Object.assign(r.steering,{tx:target['x']??a.position.x,tz:target['z']??a.position.z,v:target['speed']??0,turn:target['turn']??0});}
      }
      for(const r of this.riders){
        const a=r.a,result=r.law.event('member',{dt:step.dt,alive:Number(a.alive)});
        const fire=r.law.event('fire',{dt:step.dt,hidden:Number(a.hidden),distance:Math.hypot(p.x-a.position.x,p.z-a.position.z),engaged:Number(r.group===null||r.group.state['mode']===1)});
        if(fire['shoot']===1)r.law.event('retry',{first:0},this.random);effects.set(r,{...result,shoot:fire['shoot']??0});
      }
      const empty=Number(this.groups.some(group=>this.riders.filter(r=>r.group===group).every(r=>r.law.state['dead']===1||r.a.hidden)));
      this.cycle.event('empty',{...tick,living:this.living,killed:[...effects.values()].filter(effect=>effect['killed']===1).length,empty});
      for(let i=this.groups.length-1;i>=0;i--){const group=this.groups[i];if(group!==undefined&&this.riders.filter(r=>r.group===group).every(r=>r.law.state['dead']===1||r.a.hidden))this.groups.splice(i,1);}
    }
    for(const r of this.riders){
      const a=r.a;a.mem[actors.player.x]=p.x;a.mem[actors.player.z]=p.z;
      if(r.group!==null)for(const [slot,channel]of Object.entries(actors.steering)){const value=r.steering[channel]??r.law.state[channel];if(value!==undefined)a.mem[slot]=value;}
      if(freeze){a.mem[actors.target.x]=a.position.x;a.mem[actors.target.z]=a.position.z;}
    }
    if(step.dt>0)this.motion.project({dt:step.dt,px:p.x,pz:p.z});
    if(step.values['spawn']===1)this.spawnLine();
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i]; if (r === undefined) continue;
      const a = r.a, effect = effects.get(r), state = r.law.state;
      if (effect?.['retire'] === 1) { this.roster?.retire(a); r.scope.dispose(); this.riders.splice(i, 1); continue; }
      for (const fade of r.fades) fade.value = state[rows.states.fade] ?? 0;
      if ((state[rows.states.dying] ?? 0) > 0) cues.cue(rows.cues.tear, this.seat(r), UP);
      if (state[rows.states.dead] === 1 || a.hidden) continue;
      if (app.rng.stream('cosmetic').next() < dt * rows.trail.rate) {
        back.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        cues.cue(rows.trail.cue, this.seat(r).addScaledVector(back, rows.trail.back), back);
      }
      if (!freeze && effect?.['shoot'] === 1) this.shoot(r);
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

/** An encounter material: a self-lit `basic` colour (additive, or faded to `opacity`), an FX program (`mode`, its
 *  `alpha`, additive unless `additive` is false), a lit `lambert` colour (sRGB hex), or a ground `decal` (sRGB hex) cut
 *  by its `size` × `size` RGBA `alpha` bytes at `opacity`, pulled `offset` toward the camera. */
/** Build declared materials (the caller's scope owns their lifetime). */
function encounterMaterials(rows: Readonly<Record<string, EncounterMaterialRows>>): Map<string, THREE.Material> {
  const made = new Map<string, THREE.Material>();
  for (const [key, row] of Object.entries(rows)) {
    if (row.kind === 'fx') made.set(key, fxMaterial(FX[row.mode], new THREE.Color(...row.colour), row.alpha, row.additive ?? true));
    else if (row.kind === 'lambert') made.set(key, new THREE.MeshLambertMaterial({ color: row.colour }));
    else if (row.kind === 'decal') {
      if (row.alpha.length !== row.size * row.size * 4) throw new Error(`Decal ${key} needs size × size RGBA bytes`);
      const alphaMap = new THREE.DataTexture(Uint8Array.from(row.alpha), row.size, row.size); alphaMap.needsUpdate = true;
      made.set(key, new THREE.MeshBasicMaterial({ color: row.colour, alphaMap, transparent: true, opacity: row.opacity, depthWrite: false, fog: false,
        polygonOffset: true, polygonOffsetFactor: row.offset, polygonOffsetUnits: row.offset }));
    } else made.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(...row.colour), toneMapped: false, fog: false, ...(row.additive ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}),
      ...(row.opacity === undefined ? {} : { transparent: true, opacity: row.opacity }) }));
  }
  return made;
}
/**
 * A cloud body: `scene` and its `geometry` (`materials` by port id: a self-lit basic colour or an FX program), posed by
 * the `group` of `poses` channel rows reading the caller's `pose` fields (and its extra ports), scaled by `scale` at
 * `root`. Its `puffs` (`rows` on `bones`, an icosphere of `detail`) churn (`swell` [share, rate], `drift` [x rate, y rate,
 * m], `spin` rad/s, `squash` y) in the lent `look`, which reads `params` (time, focus point, glow, flash, alpha, fog colour
 * and fog). Its `focus` part blazes from `colour[0]` to `colour[1]` as the `open` pose field rises, its `glow` part's alpha
 * and the look's glow ride `glowAlpha` and `lookGlow` [base, gain], and its `ring` faces the camera, spinning at `spin`
 * and pulsing `pulse` [base, gain, rate] while open; `shown` parts show and hide with the body.
 */
interface Puff { readonly bone: THREE.Object3D; readonly p: THREE.Vector3; readonly r: number; readonly ph: number }
const at = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), turn = new THREE.Quaternion(), size = new THREE.Vector3(), matrix = new THREE.Matrix4();

/** A cloud body built from its rows; `update(t, camera)` poses and draws it. */
export class CloudBody {
  /** what the look reads: the fight raises `flash`, fades `alpha` and keeps the fog's colour and density */
  readonly alpha = { value: 1 }; readonly flash = { value: 0 }; readonly glow = { value: 0.4 };
  readonly fogColour = new THREE.Color(0.3, 0.32, 0.4); readonly fog = { value: 0.1 };
  readonly focusPoint = new THREE.Vector3();
  visible = false;
  private readonly rows: CloudBodyRows;
  private readonly parts: ReadonlyMap<string, THREE.Object3D>;
  readonly puffs: THREE.InstancedMesh;
  private readonly list: Puff[];
  private readonly draw: ReturnType<typeof installChannelPrograms>;
  private readonly made: Map<string, THREE.Material>;
  private readonly focusMaterial: THREE.Material; private readonly glowMaterial: THREE.Material;
  private readonly ringMaterial: THREE.Material; private readonly domeMaterial: THREE.Material;
  private time = 0;
  private readonly strip: LightningStrip | null = null;
  private stripAt: THREE.Vector3 | null = null; private stripT = 0;
  constructor(scene: THREE.Scene, input: CloudBodyRows, private readonly pose: Readonly<Record<string, number>>, ports: ReadonlyMap<string, unknown> = new Map()) {
    const rows = this.rows = input;
    this.made = encounterMaterials(rows.materials);
    const loader = new THREE.BufferGeometryLoader();
    const built = createClientScene(rows.scene, { geometry: new Map(Object.entries(rows.geometry).map(([key, row]) => [key, loader.parse(row)])), materials: this.made });
    this.parts = built.parts;
    this.part(rows.root).scale.setScalar(rows.scale); scene.add(built.root);
    this.draw = installChannelPrograms(rows.poses, rows.group, new Map<string, unknown>([...built.parts, ...ports, ['pose', this.pose]]));
    this.list = rows.puffs.rows.map(row => {
      if (!rows.puffs.bones.includes(row.bone)) throw new Error(`Cloud puff on an undeclared bone: ${row.bone}`);
      return { bone: this.part(row.bone), p: new THREE.Vector3(...row.p), r: row.r, ph: row.ph };
    });
    const geometry = new THREE.IcosahedronGeometry(1, rows.puffs.detail);
    geometry.setAttribute('aAlbedo', new THREE.InstancedBufferAttribute(new Float32Array(rows.puffs.rows.flatMap(row => row.colour)), 3));
    this.puffs = new THREE.InstancedMesh(geometry, lentLook(rows.puffs.look), Math.max(1, this.list.length));
    this.puffs.frustumCulled = false; this.puffs.castShadow = false; this.puffs.receiveShadow = false; this.puffs.name = rows.puffs.name;
    scene.add(this.puffs);
    const f = rows.focus;
    if (rows.strip !== undefined) { this.strip = new LightningStrip(scene, rows.strip.segments, new THREE.Color(...rows.strip.colour)); this.strip.alpha = 0; }
    this.focusMaterial = this.materialOf(f.part); this.glowMaterial = this.materialOf(f.glow); this.ringMaterial = this.materialOf(f.ring); this.domeMaterial = this.materialOf(f.dome);
    this.setVisible(false);
  }
  part(key: string): THREE.Object3D { const object = this.parts.get(key); if (object === undefined) throw new Error(`Missing cloud body part ${key}`); return object; }
  setVisible(on: boolean): void {
    this.visible = on; this.puffs.visible = on;
    for (const key of this.rows.shown) this.part(key).visible = on;
    if (!on) { this.part(this.rows.focus.ring).visible = false; this.part(this.rows.focus.dome).visible = false; if (this.strip !== null) this.strip.alpha = 0; }
  }
  /** Point the strip at `target` (struck) or hold it out (`null`) at `alpha` (0 hides it). */
  aim(target: THREE.Vector3 | null, alpha: number): void {
    if (this.strip === null) return;
    this.stripAt = target; this.strip.alpha = alpha;
  }
  /** the focus's world position (after `update`) */
  focusWorld(out: THREE.Vector3): THREE.Vector3 { return this.part(this.rows.focus.part).getWorldPosition(out); }
  update(t: number, camera: THREE.Camera): void {
    const rows = this.rows, c = rows.puffs, f = rows.focus, open = this.pose[f.open] ?? 0, dt = Math.max(0, t - this.time);
    this.time = t;
    this.draw.evaluate({ time: t, delta: 0, values: {} });
    this.part(rows.root).updateMatrixWorld(true);
    for (let i = 0; i < this.list.length; i++) {
      const puff = this.list[i]; if (puff === undefined) continue;
      at.copy(puff.p).applyMatrix4(puff.bone.matrixWorld);
      const k = puff.r * (1 + c.swell[0] * Math.sin(t * c.swell[1] + puff.ph));
      at.x += Math.sin(t * c.drift[0] + puff.ph) * c.drift[2]; at.y += Math.sin(t * c.drift[1] + puff.ph * 1.7) * c.drift[2];
      this.puffs.setMatrixAt(i, matrix.compose(at, turn.setFromAxisAngle(up, t * c.spin + puff.ph), size.set(k, k * c.squash, k)));
    }
    this.puffs.instanceMatrix.needsUpdate = true;
    this.focusWorld(this.focusPoint);
    const focus = this.focusMaterial, glow = this.glowMaterial, ring = this.part(f.ring), [closed, opened] = f.colour;
    if (focus instanceof THREE.MeshBasicMaterial) focus.color.setRGB(closed[0] + (opened[0] - closed[0]) * open, closed[1] + (opened[1] - closed[1]) * open, closed[2] + (opened[2] - closed[2]) * open);
    if (isFx(glow)) { glow.uniforms.uAlpha.value = f.glowAlpha[0] + f.glowAlpha[1] * open; glow.uniforms.uTime.value = t; }
    this.glow.value = f.lookGlow[0] + f.lookGlow[1] * open;
    ring.visible = this.visible && open > 0.02;
    if (ring.visible) {
      ring.position.copy(this.focusPoint); ring.lookAt(camera.position); ring.rotateZ(t * f.spin);
      this.ringMaterial.opacity = open * (f.pulse[0] + f.pulse[1] * Math.sin(t * f.pulse[2]));
    }
    if (isFx(this.domeMaterial)) this.domeMaterial.uniforms.uTime.value = t;
    this.stripT -= dt;
    if (this.strip !== null && rows.strip !== undefined && this.stripT <= 0 && this.strip.alpha > 0) {
      const s = rows.strip, hand = this.part(s.from).getWorldPosition(at);
      this.stripT = s.every;
      if (this.stripAt !== null) this.strip.set(hand, this.stripAt, s.struck[0], s.struck[1]);
      else { this.part(s.back).getWorldPosition(size).sub(hand).multiplyScalar(-1).normalize().multiplyScalar(s.reach).add(hand); this.strip.set(hand, size, s.held[0], s.held[1]); }
    }
    this.syncLook();
  }
  /** push the look's params (also after the fight changes flash or alpha between updates) */
  syncLook(): void {
    const cloud = this.rows.puffs.look, p = this.rows.params, h = this.focusPoint, c = this.fogColour;
    setLentParam(cloud, p.time, this.time); setLentParam(cloud, p.focus, [h.x, h.y, h.z]); setLentParam(cloud, p.glow, this.glow.value);
    setLentParam(cloud, p.flash, this.flash.value); setLentParam(cloud, p.alpha, this.alpha.value);
    setLentParam(cloud, p.fogColour, [c.r, c.g, c.b]); setLentParam(cloud, p.fog, this.fog.value);
  }
  private materialOf(part: string): THREE.Material {
    const object = this.part(part);
    for (const made of this.made.values()) if (object instanceof THREE.Mesh && object.material === made) return made;
    throw new Error(`Cloud body part ${part} wears no declared material`);
  }
}
function isMesh(value: unknown): value is THREE.Mesh { return value instanceof THREE.Mesh; }
function isInstances(value: unknown): value is THREE.InstancedMesh { return value instanceof THREE.InstancedMesh; }
function isFx(made: THREE.Material): made is FxMaterial { return made instanceof THREE.ShaderMaterial && 'uAlpha' in made.uniforms && 'uTime' in made.uniforms; }

/**
 * An arena's dressing: `scene` and its `geometry` in declared `materials`, its seal `wall` (those parts, standing at
 * `at` `sink` m into the ground) that rises with the seal at `ease`/s, each part spinning at its own `spin` rad/s, and
 * its ground `tells`.
 */
/** The arena's dressing built from rows; the caller lends its parts to the hazards that move them. */
export class ArenaSceneView {
  private readonly rows: ArenaSceneRows;
  private readonly parts: ReadonlyMap<string, THREE.Object3D>;
  private readonly wall: { readonly part: THREE.Object3D; readonly spin: number; readonly time: THREE.IUniform<number> | null }[];
  private readonly tellRows = new Map<string, GroundTell[]>();
  private rise = 0;
  constructor(scene: THREE.Scene, input: ArenaSceneRows) {
    const rows = this.rows = input, loader = new THREE.BufferGeometryLoader();
    const built = createClientScene(rows.scene, { geometry: new Map(Object.entries(rows.geometry).map(([key, row]) => [key, loader.parse(row)])), materials: encounterMaterials(rows.materials) });
    this.parts = built.parts;
    const [x, z] = rows.wall.at;
    this.wall = rows.wall.parts.map((key, i) => {
      const part = this.mesh(key), worn = part.material;
      part.position.set(x, heightAt(x, z) - rows.wall.sink, z);
      return { part, spin: rows.wall.spin[i] ?? 0, time: worn instanceof THREE.Material && isFx(worn) ? worn.uniforms.uTime : null };
    });
    scene.add(built.root);
    for (const [key, row] of Object.entries(rows.tells)) this.tellRows.set(key, Array.from({ length: row.count }, () => new GroundTell(scene, row.kind, new THREE.Color(...row.colour))));
  }
  /** a declared tell (its `index`th) */
  tell(key: string, index = 0): GroundTell { const tell = this.tellRows.get(key)?.[index]; if (tell === undefined) throw new Error(`Missing arena tell ${key}`); return tell; }
  /** every tell of an id */
  tells(key: string): readonly GroundTell[] { const tells = this.tellRows.get(key); if (tells === undefined) throw new Error(`Missing arena tell ${key}`); return tells; }
  mesh(key: string): THREE.Mesh { const part: unknown = this.parts.get(key); if (!isMesh(part)) throw new Error(`Missing arena mesh ${key}`); return part; }
  instances(key: string): THREE.InstancedMesh { const part: unknown = this.mesh(key); if (!isInstances(part)) throw new Error(`Missing arena instances ${key}`); return part; }
  /** the wall rises while `sealed` and sinks away after */
  update(dt: number, t: number, sealed: boolean): void {
    this.rise += ((sealed ? 1 : 0) - this.rise) * Math.min(1, dt * this.rows.wall.ease);
    for (const w of this.wall) {
      w.part.visible = this.rise > 0.02; w.part.scale.y = Math.max(0.02, this.rise); w.part.rotation.y += dt * w.spin;
      if (w.time !== null) w.time.value = t;
    }
    for (const tells of this.tellRows.values()) for (const tell of tells) tell.setTime(t);
  }
}
