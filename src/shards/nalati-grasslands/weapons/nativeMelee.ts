import type { PolearmSet, HeldPolearm } from '@wildshard/game/weapons/heldPolearm';
import type { BladeSet } from '@wildshard/game/weapons/mountedBlade';
import { MountedArsenal } from '@wildshard/game/loadout/mounted';
import rows from '../boot/mountedLoadout.generated.json' with {type:'json'};
import type { ArcWeaponPower } from '@wildshard/game/weapons/arcPower';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import type { Material,BufferGeometry } from 'three';
import type {SwordRig} from '@wildshard/engine/combat/view/melee';


export const arsenal=new MountedArsenal(rows);
const {polearm,blade}=arsenal;
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
