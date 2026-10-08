import { GOATS, RAY_HOMES, ROC, ROOST_RAYS, WISP_HOMES, type Home } from '../layout';

const flying = (id: string, kind: string, look: string, home: Home) => ({ id, kind, look, at: [home.x + home.r, home.z] as const, yaw: 0 });
/** Finite bodies only: runtime keeps flight homes, wake views, deferred WORLD floors and spawn order. */
export const SKY_SPAWNS = { homes: [], bosses: [flying('far.roc', 'stormRoc', 'storm', ROC)], actors: [
  ...RAY_HOMES.map((home, index) => flying(`far.ray.${String(index)}`, 'driftRay', 'dusk', home)),
  ...ROOST_RAYS.map((home, index) => flying(`far.roost.${String(index)}`, 'driftRay', 'dusk', home)),
  ...WISP_HOMES.map((home, index) => flying(`far.wisp.${String(index)}`, 'galeWisp', 'gale', home)),
  ...GOATS.map((goat, index) => ({ id: `far.goat.${String(index)}`, kind: 'skyGoat', look: 'cloud', at: [goat.isle.x + goat.dx, goat.isle.z + goat.dz] as const, yaw: 0 })),
] };
