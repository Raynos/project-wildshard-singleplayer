import * as v from 'valibot';
import type {NativePopulationBootRows,NativePopulationConfig} from '../../src/game/riding/nativePopulation';
import type {NalatiEncounterIntake} from './nalati-headless';

const kinds=v.pipe(v.array(v.pipe(v.string(),v.minLength(1))),v.maxLength(16));
function exact(a:unknown,b:unknown):boolean {
  if(Object.is(a,b))return true;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((value:unknown,index)=>exact(value,b[index]));
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false;
  const left=Object.keys(a).sort(),right=Object.keys(b).sort();
  return left.length===right.length&&left.every((key,index)=>key===right[index]&&exact(Reflect.get(a,key),Reflect.get(b,key)));
}
/** A closed body's existing variant declaration may lend only missing native
 * recipes and decisions. Never replace an admitted recipe or population law. */
export function validateNalatiEncounterLoans(boot:Pick<NativePopulationBootRows,'species'|'hunt'|'recipes'>,intake:NalatiEncounterIntake):void {
  const borrowed=v.parse(kinds,intake.borrowedKinds??[]),always=v.parse(kinds,intake.alwaysKinds??[]);
  if(new Set(borrowed).size!==borrowed.length||new Set(always).size!==always.length)throw new Error('Duplicate native encounter loan');
  for(const kind of borrowed){
    const row=intake.species.find(candidate=>candidate.kind===kind),admitted=boot.species[kind];
    if(row===undefined||admitted===undefined||Object.hasOwn(boot.hunt,kind)
      ||!exact(admitted,{kind:row.kind,variants:row.variants,...(row.spawnOnly===undefined?{}:{spawnOnly:row.spawnOnly})}))
      throw new Error('Native encounter must borrow its exact closed variant book');
  }
  for(const kind of always)if(!intake.species.some(row=>row.kind===kind&&row.tick==='always'))throw new Error('Native always loan differs from its admitted cadence');
  if(intake.recipes.some(row=>boot.recipes.some(admitted=>admitted.kind===row.kind&&admitted.variant===row.variant)))
    throw new Error('Native encounter cannot replace an admitted body recipe');
}

/** Ordinary encounter fixtures keep their exact original driver object. */
export function nalatiEncounterDriver(driver:NativePopulationConfig['driver'],intake:NalatiEncounterIntake):NativePopulationConfig['driver'] {
  if((intake.alwaysKinds?.length??0)===0)return driver;
  return {...driver,alwaysKinds:[...driver.alwaysKinds??[],...intake.alwaysKinds??[]]};
}
