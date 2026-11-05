import { nalatiNativeAssembly } from './nalati-native-assembly';
import * as v from 'valibot';
import type {SimHost} from '../../src/engine/server/sim';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {ledgerPorts} from '../../src/game/server/plugin/simulation';
import {openArenaArrows,openArenaOf,prepareOpenArena,type NativeOpenArena} from '../../src/game/server/boss/openArenaNative';
import {HEADLESS_ARENA} from '../../src/sdk/headlessArenaViews';
import {prepareNalatiPatrol,nalatiPatrolOf,type NalatiPatrolExtras} from './nalati-patrol-native';
import {withNalatiCompanions} from './nalati-companions-native';
import {withNalatiWeapons} from './nalati-weapons-native';

export type NativeNalatiTitan=NativeOpenArena;
export function nalatiTitanOf(host:SimHost):NativeNalatiTitan|undefined{return openArenaOf(host);}

export interface NalatiTitanPreparation extends NalatiPatrolExtras {
  /** A genuinely unopened Titan may lend input validation to the other
   * entered encounter, after every primary adapter has restored. */
  readonly closedInputOwner?:(host:SimHost)=>void;
}

/** The product's open arena on a tape's world. */
export async function prepareNalatiTitan(preparation:Parameters<PrepareHeadlessRuntime>[0],extras?:NalatiTitanPreparation):Promise<Awaited<ReturnType<PrepareHeadlessRuntime>>>{
  const assembly=v.parse(v.object({constants:v.object({nativePopulation:v.object({groups:v.string()})})}),await nalatiNativeAssembly());
  const arena=await prepareOpenArena(preparation.product,{id:'nalati.titan',fight:'combat/titan-fight.json',geometry:'combat/titan-geometry.json',view:'titan-view',
    groups:assembly.constants.nativePopulation.groups,input:{use:'nalati.titan.use',skip:'nalati.titan.skip'},target:'encounter:storm-titan:heart',grants:[]});
  const patrol:PrepareHeadlessRuntime=input=>prepareNalatiPatrol(input,arena.eliteDamage,arena.advance,arena.observeWeather,extras);
  const composed=withNalatiWeapons(withNalatiCompanions(async input=>{
    const base=await patrol(input);
    return {...base,install:(host,context)=>{
      // Bind before base.install registers that same native weather clock.
      arena.cover(host);base.install(host,context);
      arena.install(host,{presentation:HEADLESS_ARENA,commands:context.commands,ledger:ledgerPorts(context.emit),restoring:context.restoring,closedInputOwner:extras?.closedInputOwner});
    }};
  }),(host,from,dir,distance,hit)=>nalatiPatrolOf(host)?.target(from,dir,distance,hit)??hit,openArenaArrows);
  return composed(preparation);
}

export const prepareHeadlessRuntime:PrepareHeadlessRuntime=preparation=>prepareNalatiTitan(preparation);
