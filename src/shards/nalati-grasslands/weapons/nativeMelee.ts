import { PolearmSet, type HeldPolearm } from '@wildshard/game/weapons/heldPolearm';
import { BladeSet } from '@wildshard/game/weapons/mountedBlade';
import type { ArcWeaponPower } from '@wildshard/game/weapons/arcPower';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { Material,BufferGeometry } from 'three';
import type {SwordRig} from '@wildshard/engine/combat/view/melee';


const polearm=new PolearmSet({file:'weapons/spear.json',item:'weapon.spear'});
const blade=new BladeSet({file:'weapons/sabre.json',item:'weapon.sabre'});
export const Spear=polearm.Weapon;
export const Sabre=blade.Weapon;
export const NaizagaiPower=blade.Power;
export type SpearWeapon=HeldPolearm;
export type SabreWeapon=InstanceType<typeof Sabre>;
export type MountState=NonNullable<SabreWeapon['mount']>;
export type NaizagaiPowerHandle=ArcWeaponPower;
export const prepareSpear=(product:Pick<ShardProduct,'file'|'shardfile'>):Promise<void>=>polearm.prepare(product);
export const prepareSabre=(product:Pick<ShardProduct,'file'|'shardfile'>):Promise<void>=>blade.prepare(product);
export const spearGeometry=(name:string):BufferGeometry=>polearm.geometry(name);
export const spearProfile=():ReturnType<PolearmSet['profile']>=>polearm.profile();
export const buildSpear=():ReturnType<PolearmSet['display']>=>polearm.display('spear-paint','spear-metal');
export const buildJavelin=():ReturnType<PolearmSet['display']>=>polearm.display('javelin-paint','javelin-metal');
export const sabreProfile=():ReturnType<BladeSet['profile']>=>blade.profile();
export const buildSabre=(material:Material,steel:Material):SwordRig=>blade.build(material,steel);
