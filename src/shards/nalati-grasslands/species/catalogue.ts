import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { registerSpecies } from '@wildshard/engine/entities/species/registry';
import { speciesWithLook,type SpeciesLook } from '@wildshard/engine/entities/species/look';
import { NALATI_DEFINITIONS } from './definitions';
import { nalatiBehaviour, nalatiPackedLooks } from './presentation';

type Control=(typeof NALATI_DEFINITIONS)[number];

function control(row:SpeciesRow,definition:Control):SpeciesRow{return {...row,...(definition.think===undefined?{}:{think:definition.think}),...(definition.act===undefined?{}:{act:definition.act})};}
function look(kind:string,definition:Control):SpeciesLook{
  const base=nalatiBehaviour().look(nalatiPackedLooks().get(kind));
  return {...base,...(definition.postPose===undefined?{}:{postPose:definition.postPose}),...(definition.animate===undefined?{}:{animate:definition.animate}),...(definition.damageMul===undefined?{}:{damageMul:definition.damageMul})};
}
export function nalatiSpecies():SpeciesRow[]{return nalatiBehaviour().rows.map(row=>{const def=NALATI_DEFINITIONS.find(candidate=>candidate.kind===row.kind);return def===undefined?row:control(row,def);});}
export function nalatiLooks():SpeciesLook[]{return nalatiPackedLooks().all.map(row=>{const def=NALATI_DEFINITIONS.find(candidate=>candidate.kind===row.kind);return def===undefined?nalatiBehaviour().look(row):look(row.kind,def);});}
/** Test fixtures install the same admitted native rows and client looks. */
export function installNalatiSpeciesForTests():void{const looks=nalatiLooks();for(const row of nalatiSpecies()){const view=looks.find(candidate=>candidate.kind===row.kind);if(view===undefined)throw new Error('Missing species look');registerSpecies(speciesWithLook(row,view));}}
