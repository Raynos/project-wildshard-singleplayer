import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider, tagOf, type Material } from '@wildshard/engine/physics/surface';
import * as v from 'valibot';
import { createSimHost, type SimHost, type SimHostPorts, type SimLevel } from '@wildshard/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import type { Shardfile } from './shardfile';
import { simPlayerCommand, type HeadlessCommand, type HeadlessEffect } from './tickProtocol';
import type { TickWorkerAdapter } from './tickWorkerLoop';

/** Explicit trusted-code entry, chosen by the caller, never taken from an authored shardfile or asset URL. */
export interface TrustedHeadlessRuntime { module: string }
/** The same admitted bytes and native physics implementation used by the ordinary headless worker. */
export interface HeadlessRuntimePreparation { shard: Shardfile; assets: ReadonlyMap<string, Uint8Array>; rapier: Rapier }
/** Current tick inputs and buffered effects; only a completed tick publishes them to the parent. */
export interface HeadlessRuntimeInstallation {
  restoring: boolean;
  /** Strictly decoded continuation; reinstall its dynamic actor roster before native restore. Never step here. */
  snapshot?: Readonly<SimSnapshot>;
  commands: () => readonly HeadlessCommand[];
  emit: (effect: HeadlessEffect) => void;
}
/** A renderer-free native runtime. Install is synchronous and registers every mutable controller via host.onStep.
 * Restore calls install before applying the complete native snapshot. It must not step or award anything at install.
 * Optional entry walks remain independent of the live headless simulation.
 */
export interface HeadlessRuntimePlan {
  level: SimLevel;
  ports?: Pick<SimHostPorts, 'ground' | 'heightAt' | 'groundResolution'>;
  install: (host: SimHost, context: HeadlessRuntimeInstallation) => void;
  proveEntries?: (host: SimHost) => { lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number };
}
/** Export this named factory from the explicitly selected trusted entry. No browser globals or renderer imports. */
export type PrepareHeadlessRuntime = (context: HeadlessRuntimePreparation) => HeadlessRuntimePlan | Promise<HeadlessRuntimePlan>;

/** Restrict trusted code selection to a concrete local ESM entry; data-only clients never invoke this path. */
export function trustedHeadlessModule(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'file:' || url.search !== '' || url.hash !== '') throw new Error('Trusted runtime requires a local file module URL');
  return url.href;
}
function hasFactory(value: unknown): value is { prepareHeadlessRuntime: PrepareHeadlessRuntime } {
  return typeof value === 'object' && value !== null && 'prepareHeadlessRuntime' in value && typeof value.prepareHeadlessRuntime === 'function';
}
/**
 * One owned, renderer-free trusted world: the explicitly selected entry's plan installed into one native host. The worker's
 * tick adapter (`createTrustedHeadlessAdapter`) and the grid's server-side admission (a `GridSimulation` `load` port,
 * `test/proof/<slug>/grid-ready.mjs`) both compose exactly this, so an admitted region runs the same runtime, controllers
 * and continuation as the worker.
 * - `host` is owned and stepped by its owner (the worker's `step`, or `GridSimulation.step` while the region is current);
 *   it is never embedded and owns its player motor until a grid detaches it.
 * - `lend(commands)` hands the runtime the coming tick's tick-protocol commands (`HeadlessRuntimeInstallation.commands`)
 *   and opens a fresh effect buffer; `effects` reads what the runtime emitted since that lend.
 * - `step(commands)` is the worker's fenced tick: lend, the last `player` command drives the host, and a nonfinite body
 *   refuses the tick.
 */
export interface TrustedHeadlessResident {
  readonly host: SimHost;
  lend: (commands: readonly HeadlessCommand[]) => void;
  readonly effects: readonly HeadlessEffect[];
  step: (commands: readonly HeadlessCommand[]) => void;
  proveEntries: () => ReturnType<NonNullable<HeadlessRuntimePlan['proveEntries']>>;
  dispose: () => void;
}
/**
 * Load the explicitly selected trusted entry (`TrustedHeadlessRuntime`, a local file module, never a shardfile URL) and
 * install its plan into a fresh host, or into a host restored from `snapshot`. The plan must keep the shard's identity;
 * installation must not emit effects. An object continuation (the grid's packed cache) goes through the same strict wire
 * decode as the worker's string, so no path restores from a live object. A failed install disposes the world it built.
 */
export async function createTrustedHeadlessResident(preparation: HeadlessRuntimePreparation, entry: TrustedHeadlessRuntime, snapshot?: string | Readonly<SimSnapshot>): Promise<TrustedHeadlessResident> {
  const loaded: unknown = await import(/* @vite-ignore */ trustedHeadlessModule(entry.module));
  if (!hasFactory(loaded)) throw new Error('Trusted runtime must export prepareHeadlessRuntime');
  const plan = await loaded.prepareHeadlessRuntime(preparation);
  const identity = { id: preparation.shard.identity.slug, seed: preparation.shard.identity.seed };
  if (plan.level.id !== identity.id || plan.level.seed !== identity.seed) throw new Error('Trusted runtime simulation identity mismatch');
  let commands: readonly HeadlessCommand[] = [], effects: HeadlessEffect[] = [];
  const saved = snapshot === undefined ? undefined : decodeSimSnapshot(typeof snapshot === 'string' ? snapshot : serializeSimSnapshot(snapshot));
  const context: HeadlessRuntimeInstallation = { restoring: saved !== undefined, ...(saved === undefined ? {} : { snapshot: saved }), commands: () => commands, emit: effect => { effects.push(effect); } };
  const ports = { ...plan.ports, rapier: preparation.rapier };
  let installing: SimHost | undefined;
  let host: SimHost;
  try {
    if (saved === undefined) { installing = createSimHost(plan.level, ports); plan.install(installing, context); host = installing; }
    else host = restoreSimHost(plan.level, ports, saved, fresh => {
      installing = fresh; if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context);
    });
    if (effects.length > 0) throw new Error('Trusted runtime emitted gameplay effects during installation');
  } catch (error) { installing?.dispose(); throw error; }
  const lend = (input: readonly HeadlessCommand[]): void => {
    if (input.some(command => command.kind === 'interact')) throw new Error('Authored interaction commands require the data-only owner');
    commands = input; effects = []; };
  return {
    host, lend,
    get effects() { return effects; },
    step: input => {
      lend(input);
      let player: Parameters<SimHost['step']>[0];
      for (const command of input) if (command.kind === 'player') player = simPlayerCommand(command);
      host.step(player);
      if (![host.player.position, ...[...host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite))) throw new Error('Nonfinite trusted simulation state');
    },
    proveEntries: () => {
      if (plan.proveEntries === undefined) throw new Error('Trusted runtime has no entry proof');
      return plan.proveEntries(host);
    },
    dispose: () => { host.dispose(); },
  };
}
/** Worker-side composition only: owns one trusted resident (its real SimHost, native continuation and scoped installers). */
export async function createTrustedHeadlessAdapter(preparation: HeadlessRuntimePreparation, entry: TrustedHeadlessRuntime, snapshot?: string): Promise<TickWorkerAdapter> {
  const resident = await createTrustedHeadlessResident(preparation, entry, snapshot), { host } = resident;
  return {
    step: input => { resident.step(input); },
    commit: () => ({ tick: host.state.tick, snapshot: serializeSimSnapshot(snapshotSimHost(host)), effects: [...resident.effects] }),
    finish: () => ({ ticks: host.state.tick, lanes: 0, steps: 0 }),
    dispose: () => { resident.dispose(); },
  };
}

/** Strict body recipes shared by trusted native bake readers. The declared rig
 * shape retains each producer's field admission; no renderer or body is built. */
export function nativeBodySpecSchema(rig: 'segments' | 'axis'): v.GenericSchema<unknown, AnimalSimSpec> {
  const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
  const schema = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
    hp: finite, aggressive: v.boolean(), lockable: v.exactOptional(v.boolean()),
    dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite,
      capsuleAxis: v.exactOptional(v.picklist(['z', 'y'])), headAt: v.exactOptional(triple), bodyAt: v.exactOptional(triple), bodyPitch: v.exactOptional(finite),
      fore: v.exactOptional(v.strictObject({ bone: v.string(), at: triple, halfLen: finite, radius: finite })) }),
    mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }) });
  return v.pipe(schema, v.check(row => rig === 'segments' ? !Object.hasOwn(row.dims, 'capsuleAxis')
    : !['headAt','bodyAt','bodyPitch','fore'].some(key => Object.hasOwn(row.dims, key)), 'Unsupported native body rig field'));
}
/** Decode an owned copy of one native base64 buffer; typed views never share
 * caller storage. Malformed data is refused by atob or its typed-array reader. */
export function nativeBakeBytes(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), character => character.codePointAt(0) ?? 0);
}
/** The original column-major native float payload, with no resampling. */
export function nativeBakeFloats(text: string): Float32Array<ArrayBuffer> {
  return new Float32Array(nativeBakeBytes(text).buffer);
}

/** Strict raw Rapier bake records. The owner declaration chooses the original
 * provenance namespace and exact admitted collider shapes before decoding. */
export function nativeColliderSchema<const S extends readonly (1 | 2 | 6 | 9)[]>(shapes: S, owner: 'piece' | 'tagged'): v.GenericSchema<unknown, NativeColliderRecord<S[number]>> {
  const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
  const materials: Readonly<Record<Material, true>> = { sand:true,wetSand:true,grass:true,rock:true,planks:true,stone:true,water:true,
    wood:true,metal:true,flesh:true,shell:true,ground:true,edge:true,felt:true,earth:true };
  const material = v.custom<Material>(input => typeof input === 'string' && Object.hasOwn(materials,input), 'Unknown native collider material');
  const schema = v.strictObject({ shape:v.picklist(shapes), groups:finite,friction:finite,at:triple,rot:v.tuple([finite,finite,finite,finite]),
    body:v.exactOptional(v.nullable(finite)),material:v.exactOptional(material),owner:v.exactOptional(v.string()),
    ownerId:v.exactOptional(v.pipe(v.string(),v.regex(/^(?:piece|declared):[^\r\n]{1,256}$/u))),
    half:v.exactOptional(triple),halfHeight:v.exactOptional(finite),radius:v.exactOptional(finite),vertices:v.exactOptional(v.string()),indices:v.exactOptional(v.string()) });
  return v.pipe(schema,v.check(row => owner === 'piece' ? Object.hasOwn(row,'body') && !Object.hasOwn(row,'owner')
    : !['body','ownerId','indices'].some(key => Object.hasOwn(row,key)), 'Unsupported native collider provenance'));
}

/** Native collision payload after strict admission and owned typed-buffer decode. */
export interface NativeCollisionBake {
  readonly ground: { readonly heights: Float32Array; readonly friction:number;readonly groups:number;
    readonly scale:{x:number;y:number;z:number};readonly at:{x:number;y:number;z:number} };
  readonly solids:readonly NativeCollisionSolid[];
}
/** Original native shape and query provenance; no placement or material inference. */
export interface NativeCollisionSolid {
  readonly shape:1|2|6|9;readonly groups:number;readonly friction:number;
  readonly at:readonly[number,number,number];readonly rot:readonly[number,number,number,number];
  readonly half?:readonly[number,number,number];readonly halfHeight?:number;readonly radius?:number;
  readonly points?:Float32Array;readonly indices?:Uint32Array;readonly material?:Material;
  readonly ownerId?:string;readonly owner?:string;
}
/** Install the declared native lattice then its ordered solids under the actual
 * host scope. Optional record provenance preserves shared identities across
 * every collider and rebinds snapshot copies after native restore. */
export function installNativeCollision<S extends NativeCollisionSolid>(host:SimHost,bake:Omit<NativeCollisionBake,'solids'> & {readonly solids:readonly S[]},
  options:{readonly resolution:number;readonly skip?:(solid:S)=>boolean;
    readonly provenance?:{readonly field:string;readonly step:string;readonly fallback:Material}}):ReadonlyMap<string,object|string> {
  const owners=new Map<string,object|string>(),policy=options.provenance;
  if(policy!==undefined){
    if(!/^[a-z][a-zA-Z0-9]{0,63}$/u.test(policy.field))throw new Error('Invalid native owner field');
    bake.solids.forEach(solid=>{const id=solid.ownerId;if(options.skip?.(solid)===true||id===undefined||owners.has(id))return;
      if(!/^(?:piece|declared):[^\r\n]{1,256}$/u.test(id))throw new Error('Invalid baked world owner');
      owners.set(id,id.startsWith('piece:')?Object.freeze({[policy.field]:id}):id.slice('declared:'.length));});
  }
  const {R,world}=host.physics,g=bake.ground,n=options.resolution-1;
  withOwner(host.scope,()=>{
    const ground=world.createCollider(R.ColliderDesc.heightfield(n,n,g.heights,g.scale).setTranslation(g.at.x,g.at.y,g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground,'ground');
    for(const solid of bake.solids){
      if(options.skip?.(solid)===true)continue;
      const desc=solid.shape===1&&solid.half!==undefined?R.ColliderDesc.cuboid(solid.half[0],solid.half[1],solid.half[2])
        :solid.shape===2&&solid.halfHeight!==undefined&&solid.radius!==undefined?R.ColliderDesc.capsule(solid.halfHeight,solid.radius)
        :solid.shape===6&&solid.points!==undefined&&solid.indices!==undefined?R.ColliderDesc.trimesh(solid.points,solid.indices)
        :solid.shape===9&&solid.points!==undefined?R.ColliderDesc.convexHull(solid.points):null;
      if(desc===null)throw new Error('Unbuildable native collider');
      const collider=world.createCollider(desc.setTranslation(solid.at[0],solid.at[1],solid.at[2]).setRotation({x:solid.rot[0],y:solid.rot[1],z:solid.rot[2],w:solid.rot[3]})
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
      if(policy!==undefined)tagCollider(collider,solid.material??policy.fallback,solid.ownerId===undefined?null:owners.get(solid.ownerId));
      else if(solid.material!==undefined)tagCollider(collider,solid.material,solid.owner??null);
    }
  });
  if(policy!==undefined){
    host.onStep(policy.step,()=>undefined,{snapshot:()=>1,restore:value=>{if(value!==1)throw new Error('Invalid world-tag continuation');},
      physicsRestored:()=>{host.physics.world.forEachCollider(collider=>{const tag=tagOf(collider),owner=tag?.owner;
        if(tag===undefined||owner===null||typeof owner!=='object'||!(policy.field in owner))return;
        const id:unknown=Reflect.get(owner,policy.field);if(typeof id!=='string'||!owners.has(id))throw new Error('Saved native world owner is missing');
        tagCollider(collider,tag.material,owners.get(id));});}});
    host.scope.onDispose(()=>{owners.clear();});
  }
  return owners;
}

/** Validated wire collider before its binary channels become owned typed views. */
export type NativeColliderRecord<S extends 1|2|6|9 = 1|2|6|9> = Omit<NativeCollisionSolid,'points'|'indices'|'shape'> & {
  readonly shape:S;readonly body?:number|null;readonly vertices?:string;readonly indices?:string;
};
