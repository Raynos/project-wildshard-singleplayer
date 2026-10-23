import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { ReturnProgram } from '../population/returnProgram';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import type { NativeElitePopulation } from '@wildshard/engine/ai/eliteLifecycle';
import { NativeEliteRoster, type NativeEliteRosterRows, type NativeEliteRosterLoans, type NativeEliteMember } from '@wildshard/engine/ai/eliteRoster';
import { EliteCore, type EliteCoreScript } from '../eliteSystem';

const silent = (): void => undefined;
const finite = v.pipe(v.number(), v.finite());

/** Manager-owned elite pins and decision bindings; the manager retains its single body-step installer. */
export type EliteBindings = NativeEliteRosterLoans['bindings'] & { readonly absent: Set<AnimalSim> };
/** Allocate per simulation, never at module import. */
export function eliteBindings(): EliteBindings { return { pinned: new Set(), absent: new Set(), brains: new Map() }; }

interface Herd { readonly stallionState: string; readonly stallion: AnimalSim | null; readonly leadAway: (x: number, z: number) => void }
type HerdTaming = () => {readonly phase:string;readonly tulpar:AnimalSim|null}|null;
/** A member's identity, adoption and save key are author data. Pack ordering is checked against the owner's actor IDs. */
export interface EliteEncounterRow extends Pick<NativeEliteRosterRows['rows'][number], 'def' | 'snapshot' | 'continuation'> {
  readonly keeper: 'kernel' | 'herd';
  readonly member: { readonly kind: string; readonly variant: string; readonly source: 'boot' | 'spawn' | 'herd'; readonly yaw: number; readonly memory?: Readonly<Record<string, number>> };
  readonly pack?: { readonly offset: readonly [number, number]; readonly variants: readonly string[]; readonly kind: string; readonly idPrefix: string };
  readonly brokenState?: string;
  readonly onAdopted?: { readonly action: 'win-and-detach'; readonly variant: string; readonly scale: number };
}
/** The manager and group owner retain all allocation, RNG, environment and taming authority. */
export interface EliteEncounterPorts extends Pick<NativeEliteRosterLoans, 'groups'> {
  readonly bindings: EliteBindings;
  readonly herd: () => Herd | null;
  readonly taming?: HerdTaming;
  readonly keepers: { readonly herd: { readonly rows: unknown; readonly program: unknown } };
  /** Original concrete kernel owners; spawn/pack/save authorities stay here. */
  readonly kernels?: NonNullable<NativeEliteRosterLoans['kernel']> & { readonly rows: unknown };
}
/** Both wire layouts retain their existing adapter IDs, versions and field names. Upgrades explicitly name retired fields. */
export interface EliteEncounterSpec extends Readonly<Pick<NativeEliteRosterRows, 'step' | 'version' | 'wire'>> {
  readonly core: EliteCore<EliteCoreScript<AnimalSim>>;
  readonly rows?: readonly EliteEncounterRow[];
  readonly ports?: EliteEncounterPorts;
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

interface Member extends NativeEliteMember { readonly row: EliteEncounterRow; readonly controller: HerdEliteProjection }

/** Install ordered named encounters on EliteCore. Shared ownership covers spawn/adoption, script/keeper continuation,
 * pack rebind, root effects and declared permanent detachment. Controllers retain fight decisions and clocks.
 * Restore validates the complete roster, all controller payloads and identity bindings before it commits any state. */
export function installEliteEncounters(host: SimHost, spec: EliteEncounterSpec): {
  readonly core: EliteCore<EliteCoreScript<AnimalSim>>; readonly scripts: readonly EliteCoreScript<AnimalSim>[];
  readonly initialize: () => void; readonly bindPopulation: (population: NativeElitePopulation) => void;
} {
  const core = spec.core;
  if (!(core instanceof EliteCore) || Object.getPrototypeOf(core) !== EliteCore.prototype || core.player !== host.player || core.entries.length > 0) throw new Error('Foreign or populated native elite core');
  const ports = spec.ports, rows = spec.rows ?? [];
  if (ports === undefined) throw new Error('Encounter rows need native body authority');
  if (!isJsonData(rows)) throw new Error('Encounter rows require plain JSON');
  const roster = new NativeEliteRoster({ step: spec.step, version: spec.version, wire: spec.wire, rows,
    roles: rows.map(row => row.keeper === 'kernel' ? 'native' : 'borrowed'), kernels: ports.kernels?.rows ?? [] },
    { host, core, bindings: ports.bindings, ...(ports.kernels === undefined ? {} : { kernel: ports.kernels }), ...(ports.groups === undefined ? {} : { groups: ports.groups }) });
  for (let index = roster.borrowedIndex; index !== null; index = roster.borrowedIndex) {
    const row = rows[index]; if (row?.keeper !== 'herd') throw new Error('Missing borrowed encounter row');
    const def = row.def, signature = (): void => { core.signature(def.id); };
    const live = { animal: null, phase2: false, pack: null, adopted: false, detached: false };
    const herdRows = ports.keepers.herd, controller = new HerdEliteProjection(herdRows.rows, ReturnProgram.native(host, herdRows.program));
    const member: Member = Object.assign(live, { row, controller });
    const script: EliteCoreScript<AnimalSim> = {
      def, get animal() { return member.animal; },
      spawn: () => {
        const actor = ports.herd()?.stallion;
        if (actor === undefined || actor === null || !actor.alive || member.animal !== null) throw new Error('Encounter herd respawn is not hosted');
        member.animal = actor;
      },
      despawn: () => { if (member.animal !== null) ports.bindings.pinned.delete(member.animal); },
      reset: () => { member.phase2 = false; },
      enterPhase2: () => { member.phase2 = true; },
      trophy: silent,
      ...(row.brokenState === undefined ? {} : { broken: () => ports.herd()?.stallionState === row.brokenState }),
      tick: (dt, _t, engaged, _leashing) => {
        if (member.animal !== null) { if (engaged) ports.bindings.pinned.add(member.animal); else ports.bindings.pinned.delete(member.animal); }
        {
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
    roster.bindBorrowed(index, member, script);
  }
  roster.install();
  return { core, scripts: roster.scripts, initialize: () => { roster.initialize(); }, bindPopulation: population => { roster.bindPopulation(population); } };
}
