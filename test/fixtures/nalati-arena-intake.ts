import * as v from 'valibot';
import {SpeciesActorsFileSchema} from '../../src/format/speciesBookRows';
import {nativeBodySchema} from '../../src/format/nativePhysics';
import {variantMods} from '../../src/engine/entities/species/registry';
import type {ShardProduct} from '../../src/game/shardfile/shardProduct';
import type {NalatiEncounterIntake} from './nalati-headless';

/** Additional encounter recipes come from the page's complete admitted book.
 * This only preflights metadata: no actor, entropy or outcome is created. */
export async function readNalatiArenaIntake(product:Pick<ShardProduct,'json'>,kinds:readonly string[]):Promise<NalatiEncounterIntake> {
  if(kinds.length>16||new Set(kinds).size!==kinds.length)throw new Error('Duplicate native arena species');
  const actors=v.parse(SpeciesActorsFileSchema,await product.json('actors/sheep.json'));
  const rows=kinds.map(kind=>{const row=actors.species.lookBook.rows.find(candidate=>candidate.metadata.kind===kind);
    if(row===undefined||row.metadata.flight!==undefined)throw new Error('Arena has no admitted grounded species');return row;});
  const recipes=rows.flatMap(entry=>[...entry.metadata.variants,...entry.metadata.spawnOnly??[]].map(variant=>{
    const mapping=entry.variants[variant.id];if(mapping===undefined)throw new Error('Arena variant lost its body mapping');
    const body=actors.species.packedBodies.rows.find(row=>row.kind===entry.family&&row.variant===mapping.body);
    const skeleton=body===undefined?undefined:actors.species.packedBodies.skeletons[body.skeleton];
    if(skeleton===undefined)throw new Error('Arena variant lost its actual skeleton dimensions');
    const species=entry.metadata;
    return v.parse(nativeBodySchema('axis'),{kind:species.kind,label:variant.label||species.label,variant:variant.id,rarity:variant.rarity,
      hp:variant.hp??species.tuning?.hp??(species.aggressive===true?100:60),aggressive:species.aggressive??false,
      dims:structuredClone(skeleton.dims),mods:variantMods(species,variant),...(species.lockable===undefined?{}:{lockable:species.lockable})});
  }));
  return {species:rows.map(row=>row.metadata),recipes};
}
