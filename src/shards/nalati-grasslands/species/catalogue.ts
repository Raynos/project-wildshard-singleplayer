import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { registerSpecies,type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { speciesWithLook,type SpeciesLook } from '@wildshard/engine/entities/species/look';
import { argymaqDefinition } from '../combat/eliteRoster';
import { NALATI_DEFINITIONS } from './definitions';
import { speciesLookBook } from './presentation';

function definitions(): readonly SpeciesDef[] { const horse = NALATI_DEFINITIONS.find(row => row.kind === 'horse'), base = horse?.variants.find(row => row.id === 'stallion'); return horse === undefined || base === undefined ? NALATI_DEFINITIONS : [...NALATI_DEFINITIONS, argymaqDefinition(horse, base)]; }
function control(row:SpeciesRow,definition:SpeciesDef):SpeciesRow{return {...row,...(definition.think===undefined?{}:{think:definition.think}),...(definition.act===undefined?{}:{act:definition.act})};}
function look(kind:string,definition:SpeciesDef):SpeciesLook{
  const base=speciesLookBook().looks.find(row=>row.kind===kind);if(base===undefined)throw new Error('Missing species look row');
  return {...base,...(definition.postPose===undefined?{}:{postPose:definition.postPose}),...(definition.animate===undefined?{}:{animate:definition.animate}),...(definition.damageMul===undefined?{}:{damageMul:definition.damageMul})};
}
export function nalatiSpecies():SpeciesRow[]{return definitions().map(def=>{const row=speciesLookBook().rows.find(candidate=>candidate.kind===def.kind);if(row===undefined)throw new Error('Missing species metadata');return control(row,def);});}
export function nalatiLooks():SpeciesLook[]{return definitions().map(def=>look(def.kind,def));}
/** Local legacy controls remain in their species; data supplies all look/body resources. */
export function registerNalatiDefinition(def:SpeciesDef,scope:Scope|null=app.levelScope):void{
  const row=speciesLookBook().rows.find(candidate=>candidate.kind===def.kind);if(row===undefined)throw new Error('Missing derived species metadata');
  const native=control(row,def),view=look(def.kind,def);if(scope===null){registerSpecies(speciesWithLook(native,view));return;}
  app.species.registerRow(native,scope);app.species.registerLook(view,scope);
}
export function installNalatiSpeciesForTests():void{for(const def of definitions())registerNalatiDefinition(def,null);}
