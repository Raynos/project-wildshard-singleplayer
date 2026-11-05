import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { App } from '@wildshard/engine/app/app';
import { eliteAct, eliteDamageMul, eliteThink } from '@wildshard/engine/entities/eliteBrain';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { NativeSpeciesLookBookRows } from '@wildshard/format/speciesBookRows';
import { thinkCrowdGuard } from '../ambient/crowdPage';
import { arenaRoomSpeciesControl } from '../boss/arenaRoomFight';
import { ActorProjectionV2 } from './actorProjectionV2';
import { DirectedSpecies } from './directedSpecies';
import { groupSpecies } from './groupSpecies';

/** G600 L8: the species rows' behaviour hooks (group, directed, crowd guard and the elites' think / act / damage), kept
 *  outside the look book until L4 (the engine elite feature) and L5 (the wildlife group sims) absorb them; the looks are
 *  the hull book's packed looks. */
export function pageSpeciesBehaviour(book: Pick<NativeSpeciesLookBookRows, 'rows' | 'program'>, app: Pick<App, 'levelScope' | 'equipment' | 'events'>): { readonly rows: readonly SpeciesRow[]; readonly projections:ReadonlyMap<string,ActorProjectionV2>; look: (look: SpeciesLook) => SpeciesLook } {
  if(book.rows.some(row=>row.control!==undefined&&(row.projection!==undefined||row.group!==undefined||row.directed!==undefined||row.guard===true||row.elite===true)))throw new Error('Conflicting species controls');
  const controls=new Map(book.rows.flatMap(row=>row.control===undefined?[]:[[row.metadata.kind,arenaRoomSpeciesControl(row.control)] as const]));
  const projections=new Map(book.rows.flatMap(row=>row.projection===undefined?[]:[[row.metadata.kind,new ActorProjectionV2(row.metadata.kind,row.projection,app)] as const]));
  const rows = book.rows.map(row => ({ ...row.metadata, ...controls.get(row.metadata.kind), ...(projections.get(row.metadata.kind)?.binding), ...(row.group === undefined ? {} : groupSpecies(row.group)), ...(row.directed === undefined ? {} : new DirectedSpecies(row.directed, book.program, app).binding),
    ...(row.guard === true ? { think: thinkCrowdGuard } : {}), ...(row.elite === true ? { think: eliteThink, act: eliteAct } : {}) }));
  const elites = new Set(book.rows.flatMap(row => row.elite === true ? [row.metadata.kind] : []));
  return { rows, projections, look: look => {const controlled=projections.get(look.kind)?.binding.damageMul??controls.get(look.kind)?.damageMul;return controlled!==undefined?{...look,damageMul:controlled}:elites.has(look.kind)?{...look,damageMul:eliteDamageMul}:look;} };
}
