import { createFireFx } from '../runtime/looks/fireFx';
import { FIRE_STYLE } from '../data/fire';

/**
 * Signal Dunes' fires, embers and smoke: the platform's fire effect (`@wildshard/game/systems/looks/fireFx`) in Signal's
 * own look (`data/fire.ts` FIRE_STYLE, its sizes the rows beside it). The firelight uniform warms the hero brazier's and
 * the camp's materials (world/meshes.ts warmByFire) and the sand's light pools (look/render.ts).
 * G377 (Jake): the hand-written fire shaders stay; the baked B path and its Debug row are gone.
 */
const fx = createFireFx(FIRE_STYLE);
export const addFire: typeof fx.addFire = (...args) => fx.addFire(...args), addLampGlow: typeof fx.addLampGlow = (...args) => { fx.addLampGlow(...args); };
export const fireLight: typeof fx.fireLight = (at) => fx.fireLight(at), fireGeometries = (): ReturnType<typeof fx.geometries> => fx.geometries();
export const FIRE_LIGHTS = fx.lights, fireResources = (): readonly { dispose: () => void }[] => fx.resources;
export const resetFireLights = (): void => { fx.resetLights(); }, tickFires = (t: number): void => { fx.tick(t); }, loadFireBook = (): (() => void) => fx.loadBook();
