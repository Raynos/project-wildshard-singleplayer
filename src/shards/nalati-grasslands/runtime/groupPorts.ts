import { NALATI_STRIKES, sampleStrike } from '../combat/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackPorts } from '@wildshard/engine/ai/pack';
import { terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';

import type * as THREE from 'three';

import { wildEnv, playerVisibility, downwindOf, hearingRadius, type WildEnv } from '../creatures/env';

import type { HerdPorts } from '@wildshard/engine/ai/herd';
import type { GroupName } from '@wildshard/engine/physics/groups';
import { Pack } from './groupRegistry';

const THROUGH_PLAYER: readonly GroupName[] = ['PLAYER'], BLOCKED: readonly GroupName[] = [];

function inChunk(x: number, z: number, margin = 0): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }

/** The host-owned contact a native strike recipe needs: the player, the line-of-sight check and the damage route. */
export interface NativeContact<A extends AnimalSim> { readonly player: THREE.Vector3; readonly reach: (actor: A) => boolean; readonly hurt: (damage: number) => void }
/** Refuse a native contact recipe without its host-owned LOS and damage ports. */
export function nativeContactContext<A extends AnimalSim>(context: { player: THREE.Vector3 }): NativeContact<A> {
  if (!hasContact<A>(context)) throw new Error('Unbound native group contact');
  return context;
}
function hasContact<A extends AnimalSim>(context: { player: THREE.Vector3 }): context is NativeContact<A> {
  return 'reach' in context && typeof context.reach === 'function' && 'hurt' in context && typeof context.hurt === 'function';
}
/**
 * The host services a declared group asks (SF72): the shared 'ai' decision stream and the aggression director's
 * registration. The page binds the app's (runtime/groupHost.ts); a trusted Node host binds its own, so the declared
 * policies load without the renderer.
 */
export interface NativeGroupHost<A extends AnimalSim = Animal> {
  readonly sharedRng: PackPorts<A>['sharedRng'];
  readonly register: PackPorts<A>['register'];
}
/** The per-world services a declared group reads beside its host (SF72): the wild view its senses read (the page's
 *  `wildEnv`), the ground's slope, and the body seams (a stampede's pass-through, the pack a stallion scatters). */
export interface NativeGroupWorld<A extends AnimalSim> {
  readonly env: WildEnv;
  readonly normalY: (x: number, z: number) => number;
  readonly passThrough: (actor: A, player: boolean) => void;
  readonly packOf: (actor: A) => { scare: (x: number, z: number, radius: number) => void } | null;
}
/** The page's world: `wildEnv`, the installed terrain's normal, the body's own motor, the shared pack lookup. */
export const PAGE_GROUP_WORLD: NativeGroupWorld<Animal> = {
  env: wildEnv, normalY: (x, z) => normalAt(x, z)[1],
  passThrough: (actor, through) => { actor.motor?.passThrough(through ? THROUGH_PLAYER : BLOCKED); },
  packOf: actor => Pack.of(actor),
};
/** Shipping sensing, token and strike recipes consume only a host-owned species context with native contact LOS. */
export function nativePackPorts<A extends AnimalSim>(host: NativeGroupHost<A>, world: NativeGroupWorld<A>): PackPorts<A> {
  const env = world.env;
  return {
    sharedRng: host.sharedRng, environment: () => env, visibility: (x, z, player, speed, time) => playerVisibility(x, z, player, speed, time, env),
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed, env), downwind: (x, z, player) => downwindOf(x, z, player, env),
    inBounds: inChunk, normalY: world.normalY,
    register: host.register,
    bite: (actor, context, radius) => {
      const native = nativeContactContext<A>(context);
      sampleStrike(NALATI_STRIKES.wolf, actor, native.player, () => { native.hurt(actor.mods.chargeDamage); },
        { shape: { kind: 'point', radius, exclusive: true }, reach: () => native.reach(actor) });
    }, onEvent: (event, x, z) => { env.onEvent?.(event, x, z); },
  };
}

/** Shipping perception, ghost filter, kick/contact and shared RNG; taming and elite recipes retain their actors. */
export function nativeHerdPorts<A extends AnimalSim>(host: NativeGroupHost<A>, world: NativeGroupWorld<A>): HerdPorts<A> {
  const env = world.env;
  return {
    sharedRng: host.sharedRng, environment: () => env, visibility: (x, z, player, speed, time) => playerVisibility(x, z, player, speed, time, env),
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed, env), downwind: (x, z, player) => downwindOf(x, z, player, env),
    inBounds: inChunk, normalY: world.normalY,
    passThrough: world.passThrough,
    chargeContact: (actor, context, radius) => {
      const native = nativeContactContext<A>(context);
      sampleStrike(NALATI_STRIKES.stallion, actor, native.player, () => { native.hurt(actor.mods.chargeDamage); },
        { shape: { kind: 'point', radius, exclusive: true }, reach: () => native.reach(actor) });
    },
    scarePack: (actor, radius) => { const pack = world.packOf(actor); if (pack === null) return false; pack.scare(actor.position.x, actor.position.z, radius); return true; },
    onEvent: (event, x, z) => { env.onEvent?.(event, x, z); },
    onKnockdown: (x, z, strength) => { env.onKnockdown?.(x, z, strength); },
  };
}
