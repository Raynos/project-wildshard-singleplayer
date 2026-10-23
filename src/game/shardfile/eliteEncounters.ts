import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { ReturnProgram } from '../population/returnProgram';
import { NativeEliteContinuation, type EliteContinuationGroups } from '@wildshard/engine/ai/eliteContinuation';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { NativeEliteKernels, type NativeEliteKernelLoans } from '@wildshard/engine/ai/eliteKernels';
import type { StalkerBrain } from '@wildshard/engine/ai/stalker';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { EliteCore, type EliteCoreDef, type EliteCoreScript } from '../eliteSystem';

const silent = (): void => undefined;
const finite = v.pipe(v.number(), v.finite());

/** Manager-owned elite pins and decision bindings; the manager retains its single body-step installer. */
export interface EliteBindings {
  readonly pinned: Set<AnimalSim>;
  readonly absent: Set<AnimalSim>;
  readonly brains: NativeEliteKernelLoans['brains'];
}
/** Allocate per simulation, never at module import. */
export function eliteBindings(): EliteBindings { return { pinned: new Set(), absent: new Set(), brains: new Map() }; }

interface Herd { readonly stallionState: string; readonly stallion: AnimalSim | null; readonly leadAway: (x: number, z: number) => void }
type HerdTaming = () => {readonly phase:string;readonly tulpar:AnimalSim|null}|null;
/** A member's identity, adoption and save key are author data. Pack ordering is checked against the owner's actor IDs. */
export interface EliteEncounterRow {
  readonly def: EliteCoreDef;
  readonly keeper: 'kernel' | 'herd'; readonly snapshot: string;
  readonly member: { readonly kind: string; readonly variant: string; readonly source: 'boot' | 'spawn' | 'herd'; readonly yaw: number; readonly memory?: Readonly<Record<string, number>> };
  readonly pack?: { readonly offset: readonly [number, number]; readonly variants: readonly string[]; readonly kind: string; readonly idPrefix: string };
  readonly continuation?: { readonly borrowed?: { readonly group: number; readonly role: 'guard' }; readonly detachable?: true };
  readonly brokenState?: string;
  readonly onAdopted?: { readonly action: 'win-and-detach'; readonly variant: string; readonly scale: number };
}
/** The manager and group owner retain all allocation, RNG, environment and taming authority. */
export interface EliteEncounterPorts {
  readonly bindings: EliteBindings; readonly bodies: () => readonly AnimalSim[];
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => AnimalSim;
  readonly retire: (a: AnimalSim) => void;
  readonly spawnPack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>;
  readonly retirePack: (pack: PackBrain<AnimalSim>) => void;
  readonly groups?: EliteContinuationGroups;
  readonly herd: () => Herd | null;
  readonly taming?: HerdTaming;
  readonly keepers: { readonly herd: { readonly rows: unknown; readonly program: unknown } };
  /** Original concrete kernel owners; spawn/pack/save authorities stay here. */
  readonly kernels?: Omit<NativeEliteKernelLoans, 'scope' | 'host' | 'lifecycle' | 'brains'> & { readonly rows: unknown };
}
/** Both wire layouts retain their existing adapter IDs, versions and field names. Upgrades explicitly name retired fields. */
export interface EliteEncounterSpec {
  readonly step: string; readonly version: number;
  readonly core: EliteCore<EliteCoreScript<AnimalSim>>;
  readonly rows?: readonly EliteEncounterRow[];
  readonly ports?: EliteEncounterPorts;
  readonly wire: { readonly detached?: string };
}

const herdPoint=v.tuple([finite,finite,finite]);
const HerdProjectionRows=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({signal:v.pipe(v.string(),v.minLength(1),v.maxLength(128)),states:v.pipe(v.record(v.string(),finite),v.check(rows=>Object.keys(rows).length<=16))}));
const HerdProjectionSaved=v.strictObject({laneT:finite,runT:finite,lastState:v.string(),elapsed:v.optional(finite,0),laneFrom:herdPoint,laneTo:herdPoint});
/** Numeric native herd encounter observation. Bodies and rewards remain with
 * the existing encounter authority; no content callback or actor port enters. */
export interface HerdEliteFrame {
  state:string;phase2:boolean;engaged:boolean;bonded:boolean;same:boolean;health:number;
  at:readonly [number,number,number];player:readonly [number,number,number];
}
/** Renderer-free ten-Hz guest projection. Rows name the admitted event and herd
 * states; effects are plain commands and the historical continuation is kept. */
export class HerdEliteProjection {
  private readonly rows;
  private state:v.InferOutput<typeof HerdProjectionSaved>={laneT:0,runT:0,lastState:'',elapsed:0,laneFrom:[0,0,0],laneTo:[0,0,0]};
  private readonly effects={signature:false,lead:false,adopt:false};
  constructor(input:unknown,private readonly program:ReturnProgram){
    if(!(program instanceof ReturnProgram)||Object.getPrototypeOf(program)!==ReturnProgram.prototype)throw new Error('Missing native encounter programme');
    this.rows=v.parse(HerdProjectionRows,input);
  }
  advance(dt:number,frame:HerdEliteFrame):Readonly<{signature:boolean;lead:boolean;adopt:boolean}>{
    const state=this.state,effects=this.effects;effects.signature=false;effects.lead=false;effects.adopt=false;
    state.elapsed+=dt;if(state.elapsed+1e-9<.1)return effects;
    const result=this.program.project(this.rows.signal,{dt:state.elapsed,state:this.rows.states[frame.state]??0,previousState:this.rows.states[state.lastState]??0,
      laneT:state.laneT,runT:state.runT,phase2:Number(frame.phase2),engaged:Number(frame.engaged),bonded:Number(frame.bonded),same:Number(frame.same),health:frame.health});
    state.elapsed=0;state.lastState=frame.state;state.laneT=result['laneT']??state.laneT;state.runT=result['runT']??state.runT;
    if(result['capture']===1){state.laneFrom=[...frame.at];state.laneTo=[...frame.player];}
    effects.signature=result['signature']===1;effects.lead=result['lead']===1;effects.adopt=result['adopt']===1;return effects;
  }
  snapshot():v.InferOutput<typeof HerdProjectionSaved>{return structuredClone(this.state);}
  prepareRestore(input:unknown):()=>void{const state=v.parse(HerdProjectionSaved,input);return()=>{this.state=state;};}
  restore(input:unknown):void{this.prepareRestore(input)();}
}

interface Member { readonly row: EliteEncounterRow; animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean;
  readonly controller: StalkerBrain<AnimalSim> | HerdEliteProjection }

/** Install ordered named encounters on EliteCore. Shared ownership covers spawn/adoption, script/keeper continuation,
 * pack rebind, root effects and declared permanent detachment. Controllers retain fight decisions and clocks.
 * Restore validates the complete roster, all controller payloads and identity bindings before it commits any state. */
export function installEliteEncounters(host: SimHost, spec: EliteEncounterSpec): {
  readonly core: EliteCore<EliteCoreScript<AnimalSim>>; readonly scripts: readonly EliteCoreScript<AnimalSim>[];
  readonly initialize: () => void;
} {
  const core = spec.core;
  if (!(core instanceof EliteCore) || Object.getPrototypeOf(core) !== EliteCore.prototype || core.player !== host.player || core.entries.length > 0) throw new Error('Foreign or populated native elite core');
  const ports = spec.ports, rows = spec.rows ?? [], members: Member[] = [];
  const pin = (a: AnimalSim | null, engaged: boolean): void => { if (a === null || ports === undefined) return; if (engaged) ports.bindings.pinned.add(a); else ports.bindings.pinned.delete(a); };
  const kernels = ports?.kernels === undefined ? null : new NativeEliteKernels(ports.kernels.rows, {
    ...ports.kernels, host, scope: host.scope, lifecycle: core, brains: ports.bindings.brains,
  });
  const nativeIds = rows.filter(row => row.keeper !== 'herd').map(row => row.def.id);
  if (nativeIds.length !== (kernels?.declaredRows.length ?? 0) || nativeIds.some(id => !kernels?.declaredRows.some(row => row.id === id))) throw new Error('Incomplete native elite kernels');
  const nativeScripts: EliteCoreScript<AnimalSim>[] = [];
  for (const row of rows) {
    if (ports === undefined) throw new Error('Encounter rows need native body authority');
    const def = row.def;
    const signature = (): void => { core.signature(def.id); };
    const live: { animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean } = { animal: null, phase2: false, pack: null, adopted: false, detached: false };
    const create = (): StalkerBrain<AnimalSim> | HerdEliteProjection => {
      if (row.keeper !== 'herd') { if (kernels === null) throw new Error('Missing native elite kernels'); return kernels.create(def.id, live); }
      const herd=ports.keepers.herd;return new HerdEliteProjection(herd.rows,ReturnProgram.native(host,herd.program));
    };
    const controller = create();
    const member: Member = Object.assign(live, { row, controller });
    members.push(member);
    const bind = (a: AnimalSim): void => {
      if (!('think' in controller)) return;
      if (kernels === null) throw new Error('Missing native elite kernels'); kernels.bind(def.id, controller, live, a);
    };
    const script: EliteCoreScript<AnimalSim> = {
      def, get animal() { return member.animal; },
      spawn: () => {
        if (row.member.source === 'herd') {
          const a = ports.herd()?.stallion;
          if (a === undefined || a === null || !a.alive || member.animal !== null) throw new Error('Encounter herd respawn is not hosted');
          member.animal = a; return;
        }
        const boot = row.member.source === 'boot' && !member.adopted ? ports.bodies().find(a => a.kind === row.member.kind && a.variant === row.member.variant) : undefined;
        member.adopted = true;
        const a = boot ?? ports.spawn(row.member.kind, def.lair.x, def.lair.z, row.member.yaw, row.member.variant);
        member.animal = a; a.herd = -1;
        for (const [key, value] of Object.entries(row.member.memory ?? {})) a.mem[key] = value;
        if ('spawned' in controller) controller.spawned(a);
        bind(a);
        if (row.pack !== undefined) { member.pack = ports.spawnPack(def.lair.x + row.pack.offset[0], def.lair.z + row.pack.offset[1], row.pack.variants); member.pack.homeX = def.lair.x; member.pack.homeZ = def.lair.z; }
      },
      despawn: () => {
        if ('disposeTell' in controller) controller.disposeTell();
        if (member.pack !== null) ports.retirePack(member.pack); member.pack = null;
        const a = member.animal; pin(a, false);
        if (row.member.source === 'herd') return;
        if (a !== null) { ports.bindings.brains.delete(a); ports.retire(a); } member.animal = null;
      },
      reset: () => { member.phase2 = false; if ('reset' in controller) controller.reset(member.animal); },
      enterPhase2: () => { member.phase2 = true; if ('think' in controller) { if (kernels === null) throw new Error('Missing native elite kernels'); kernels.enterPhase2(def.id, controller, live); } },
      trophy: silent,
      ...(row.brokenState === undefined ? {} : { broken: () => ports.herd()?.stallionState === row.brokenState }),
      tick: (dt, t, engaged, leashing) => {
        pin(member.animal, engaged);
        if ('think' in controller) controller.advance(member.animal, dt, t, engaged, leashing);
        else {
          const animal=member.animal,herd=member.detached?null:ports.herd();if(animal===null||herd===null)return;
          const taming=ports.taming?.(),at=animal.position,player=host.player.position;
          const effects=controller.advance(dt,{state:herd.stallionState,phase2:member.phase2,engaged,bonded:taming?.phase==='bonded',same:herd.stallion===animal,health:animal.hp/animal.maxHp,at:[at.x,at.y,at.z],player:[player.x,player.y,player.z]});
          if(effects.signature)signature();if(effects.lead)herd.leadAway(player.x,player.z);
          const adopted=taming?.tulpar;
          if(effects.adopt&&adopted!==undefined&&adopted!==null){
            const action=row.onAdopted;if(action===undefined||member.detached||host.entities.get(adopted.entityId)!==adopted||adopted.variant!==action.variant)throw new Error('Adopted encounter reward has no native owner');
            adopted.scale=action.scale;core.won(def.id);member.detached=true;
          }
        }
      },
    };
    nativeScripts.push(script);
  }
  const scripts = nativeScripts;
  if (scripts.length === 0 || new Set(scripts.map(s => s.def.id)).size !== scripts.length) throw new Error('Invalid encounter roster');
  scripts.forEach(s => { core.add(s); });
  const continuation = new NativeEliteContinuation({ version: spec.version, wire: spec.wire, rows },
    { host, core, members, bindings: ports?.bindings ?? eliteBindings(), kernels, ...(ports?.groups === undefined ? {} : { groups: ports.groups }) });
  host.onStep(spec.step, dt => { core.update(dt, host.clock.now); }, continuation);
  return { core, scripts, initialize: () => { core.initialize(); } };
}
