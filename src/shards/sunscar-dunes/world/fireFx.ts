import { createFireFx } from '../runtime/looks/fireFx';
import { createBakedFire } from './fireBaked';
import { FIRE_STYLE } from '../data/fire';

/**
 * Signal Dunes' fires, embers and smoke: the platform's fire effect (`@wildshard/game/systems/looks/fireFx`) in Signal's
 * own look (`data/fire.ts` FIRE_STYLE, its sizes the rows beside it). The firelight uniform warms the hero brazier's and
 * the camp's materials (world/meshes.ts warmByFire) and the sand's light pools (look/render.ts).
 * G345 "Signal look" B (`useBakedFire`, read once per world build): the same fires on standard materials (`fireBaked.ts`).
 */
const a = createFireFx(FIRE_STYLE), b = createBakedFire(FIRE_STYLE, a.lights);
let fx: Pick<typeof b, 'addFire' | 'addLampGlow' | 'fireLight' | 'geometries' | 'resetLights' | 'tick' | 'loadBook'> & { resources: readonly { dispose: () => void }[] } = a;
export const useBakedFire = (baked: boolean): void => { fx = baked ? b : a; };
export const addFire: typeof b.addFire = (...args) => fx.addFire(...args), addLampGlow: typeof b.addLampGlow = (...args) => { fx.addLampGlow(...args); };
export const fireLight: typeof b.fireLight = (at) => fx.fireLight(at), fireGeometries = (): ReturnType<typeof b.geometries> => fx.geometries();
export const FIRE_LIGHTS = a.lights, fireResources = (): readonly { dispose: () => void }[] => fx.resources;
export const resetFireLights = (): void => { fx.resetLights(); }, tickFires = (t: number): void => { fx.tick(t); }, loadFireBook = (): (() => void) => fx.loadBook();
