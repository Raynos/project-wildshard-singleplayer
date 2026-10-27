import { DEER } from './deerRows';
import { ELK } from './elkRows';
import { hullBody } from './grazerBodies';

/** Pine's authored species and hull-only skeletons for the existing species/look/model owners. GR8: the product calls
 *  this directly (no scheduler job, no generated file); no procedural skeleton construction runs in play. Keys in the
 *  original order, deer then elk. */
export function grazerRows(): {
  deer: typeof DEER & { id: string; body: ReturnType<ReturnType<typeof hullBody>> };
  elk: typeof ELK & { id: string; body: ReturnType<ReturnType<typeof hullBody>> };
} {
  return { deer: { ...DEER, id: 'pine.creature.deer', body: hullBody('deer')() }, elk: { ...ELK, id: 'pine.creature.elk', body: hullBody('elk')() } };
}
