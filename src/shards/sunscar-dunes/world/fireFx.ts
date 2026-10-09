import { createFireFx } from '@wildshard/game/systems/looks/fireFx';
import { FIRE_STYLE } from '../data/fire';

/**
 * Signal Dunes' fires, embers and smoke: the platform's fire effect (`@wildshard/game/systems/looks/fireFx`) in Signal's
 * own look (`data/fire.ts` FIRE_STYLE, its sizes the rows beside it). The firelight uniform warms the hero brazier's and
 * the camp's materials (world/meshes.ts warmByFire) and the sand's light pools (look/render.ts).
 */
const fx = createFireFx(FIRE_STYLE);
export const { addFire, addLampGlow, fireLight, geometries: fireGeometries } = fx;
export const FIRE_LIGHTS = fx.lights, FIRE_RESOURCES = fx.resources;
export const resetFireLights = fx.resetLights, tickFires = fx.tick, loadFireBook = fx.loadBook;
