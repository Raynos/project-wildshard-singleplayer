import { nalatiNativeAssembly } from './nalati-native-assembly';
import * as v from 'valibot';
import {installCombatMotion} from '@wildshard/game/shardfile/nativeRuntimeLoans';
import {heldArmsOf,prepareHeldArms,type HeldArrowTargets,type HeldRay,type HeldSeat} from '../../src/game/server/weapons/nativeHeld';
import type {SimHost} from '../../src/engine/server/sim';
import type {PrepareHeadlessRuntime} from '../../src/sdk/headlessRuntime';
import {prepareHeadlessRuntime as prepareCompanions} from './nalati-companions-native';

/** The product's arms on a tape's world. */
export type NalatiWeaponRay=HeldRay;
export type NalatiArrowTargets=HeldArrowTargets;
export type NativeNalatiWeapons=Pick<HeldSeat,'setEnabled'|'refill'|'look'>;
export function nalatiWeaponsOf(host:SimHost):NativeNalatiWeapons|undefined{return heldArmsOf(host)?.lead;}
export function withNalatiWeapons(prepare:PrepareHeadlessRuntime,contacts?:NalatiWeaponRay,arrowTargets?:NalatiArrowTargets):PrepareHeadlessRuntime {return async preparation=>{
  const base=await prepare(preparation),assembly=await nalatiNativeAssembly();
  const weather=v.parse(v.object({constants:v.object({nativeWeather:v.unknown()})}),assembly).constants.nativeWeather;
  const arms=await prepareHeldArms(preparation.product,{step:'nalati.weapons',slots:'held/slots.json',weather,
    input:{attack:'nalati.weapon.attack',swap:'nalati.weapon.swap',aim:'nalati.weapon.aim',pitch:'nalati.weapon.pitch'}});
  return {...base,install:(host,context)=>{
    const combat=context.combat;if(combat===undefined)throw new Error('Native weapons require their actual input frame');
    base.install(host,context);
    installCombatMotion(host,context,7.2);
    arms(host,{combat,contacts,arrowTargets,tick:{commands:context.commands,commandsOf:id=>context.playerCommands?.(id)??[]}});
  }};
};}

export const prepareHeadlessRuntime:PrepareHeadlessRuntime=withNalatiWeapons(prepareCompanions);
