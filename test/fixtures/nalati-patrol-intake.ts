import * as v from 'valibot';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {TimedEncountersSchema} from '../../src/format/encounterRows';
import {nativeBodySchema} from '../../src/format/nativePhysics';
import {variantMods} from '../../src/engine/entities/species/registry';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';
import type {NalatiEncounterIntake} from './nalati-headless';

/** Conditional riders borrow the page's exact metadata and packed skeleton
 * dimensions. No body, random draw, model build or generated output is made. */
export async function readNalatiPatrolIntake(product:Pick<ShardProduct,'json'>):Promise<NalatiEncounterIntake> {
  const [actors,timed]=await Promise.all([
    product.json<unknown>('actors/sheep.json').then(value=>v.parse(SpeciesActorsFileSchema,value)),
    product.json<unknown>('combat/timed-encounters.json').then(value=>v.parse(TimedEncountersSchema,value)),
  ]);
  const declaration=timed.patrol.actors;if(declaration===undefined)throw new Error('Patrol has no admitted rider declarations');
  const entry=actors.species.lookBook.rows.find(row=>row.metadata.kind===declaration.kind);
  if(entry===undefined)throw new Error('Patrol has no admitted species metadata');
  const species=entry.metadata;
  if(species.flight!==undefined)throw new Error('Patrol requires its original grounded body law');
  const recipes=[...species.variants,...species.spawnOnly??[]].map(variant=>{
    const selected=entry.variants[variant.id];
    if(selected===undefined)throw new Error('Patrol variant lacks its declared page body mapping');
    const body=actors.species.packedBodies.rows.find(row=>row.kind===entry.family&&row.variant===selected.body);
    const skeleton=body===undefined?undefined:actors.species.packedBodies.skeletons[body.skeleton];
    if(skeleton===undefined)throw new Error('Patrol variant lacks its original body dimensions');
    return v.parse(nativeBodySchema('axis'),{
      kind:species.kind,label:variant.label||species.label,variant:variant.id,rarity:variant.rarity,
      hp:variant.hp??species.tuning?.hp??(species.aggressive===true?100:60),
      aggressive:species.aggressive??false,dims:structuredClone(skeleton.dims),mods:variantMods(species,variant),
      ...(species.lockable===undefined?{}:{lockable:species.lockable}),
    });
  });
  for(const variant of [declaration.variant,declaration.leader])if(!recipes.some(row=>row.variant===variant))throw new Error('Patrol is missing an admitted variant recipe');
  return {species:[species],recipes};
}
