import { NALATI_STRIKES, sampleStrike } from '../combat/strikes';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { PackPorts } from '@wildshard/engine/ai/pack';
import { terrainNormal as normalAt } from '@wildshard/engine/world/terrainHeight';

import type * as THREE from 'three';

import { wildEnv, playerVisibility, downwindOf, hearingRadius } from '../creatures/env';

import type { HerdPorts } from '@wildshard/engine/ai/herd';
import type { GroupName } from '@wildshard/engine/physics/groups';
import { Pack } from './groupRegistry';

const THROUGH_PLAYER: readonly GroupName[] = ['PLAYER'], BLOCKED: readonly GroupName[] = [];

function inChunk(x: number, z: number, margin = 0): boolean { return Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin; }

/** Refuse a native contact recipe without its host-owned LOS and damage ports. */
export function nativeContactContext(context: { player: THREE.Vector3 }): Pick<ThinkCtx, 'player' | 'reach' | 'hurt'> {
  if (!hasContact(context)) throw new Error('Unbound native group contact');
  return context;
}
function hasContact(context: { player: THREE.Vector3 }): context is Pick<ThinkCtx, 'player' | 'reach' | 'hurt'> {
  return 'reach' in context && typeof context.reach === 'function' && 'hurt' in context && typeof context.hurt === 'function';
}
/**
 * The host services a declared group asks (SF72): the shared 'ai' decision stream and the aggression director's
 * registration. The page binds the app's (runtime/groupHost.ts); a trusted Node host binds its own, so the declared
 * policies load without the renderer.
 */
export interface NativeGroupHost {
  readonly sharedRng: PackPorts<Animal>['sharedRng'];
  readonly register: PackPorts<Animal>['register'];
}
/** Shipping sensing, token and strike recipes consume only a host-owned species context with native contact LOS. */
export function nativePackPorts(host: NativeGroupHost): PackPorts<Animal> {
  return {
    sharedRng: host.sharedRng, environment: () => wildEnv, visibility: playerVisibility,
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed), downwind: downwindOf,
    inBounds: inChunk, normalY: (x, z) => normalAt(x, z)[1],
    register: host.register,
    bite: (actor, context, radius) => {
      const native = nativeContactContext(context);
      sampleStrike(NALATI_STRIKES.wolf, actor, native.player, () => { native.hurt(actor.mods.chargeDamage); },
        { shape: { kind: 'point', radius, exclusive: true }, reach: () => native.reach(actor) });
    }, onEvent: (event, x, z) => { wildEnv.onEvent?.(event, x, z); },
  };
}

/** Shipping perception, ghost filter, kick/contact and shared RNG; taming and elite recipes retain their actors. */
export function nativeHerdPorts(host: NativeGroupHost): HerdPorts<Animal> {
  return {
    sharedRng: host.sharedRng, environment: () => wildEnv, visibility: playerVisibility,
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed), downwind: downwindOf,
    inBounds: inChunk, normalY: (x, z) => normalAt(x, z)[1],
    passThrough: (actor, through) => { actor.motor?.passThrough(through ? THROUGH_PLAYER : BLOCKED); },
    chargeContact: (actor, context, radius) => {
      const native = nativeContactContext(context);
      sampleStrike(NALATI_STRIKES.stallion, actor, native.player, () => { native.hurt(actor.mods.chargeDamage); },
        { shape: { kind: 'point', radius, exclusive: true }, reach: () => native.reach(actor) });
    },
    scarePack: (actor, radius) => { const pack = Pack.of(actor); if (pack === null) return false; pack.scare(actor.position.x, actor.position.z, radius); return true; },
    onEvent: (event, x, z) => { wildEnv.onEvent?.(event, x, z); },
    onKnockdown: (x, z, strength) => { wildEnv.onKnockdown?.(x, z, strength); },
  };
}
