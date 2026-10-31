import {expect,test} from 'vitest';
import type {SpeciesData,SpeciesVariantData} from '../src/format/speciesPrograms';
import {SIM_LEVEL} from './fixtures/sim-level/level';
import type {NalatiEncounterIntake} from './fixtures/nalati-headless';
import {validateNalatiEncounterLoans} from './fixtures/nalati-encounter-loans';

const variant:SpeciesVariantData={id:'king',label:'King',rarity:'legendary',weight:1,scale:[1.22,1.22],hp:2400};
const species:SpeciesData={id:'test.king',kind:'king',label:'King',tick:'always',variants:[variant]};
const intake:NalatiEncounterIntake={species:[species],recipes:[],borrowedKinds:['king'],alwaysKinds:['king']};
const boot={species:{king:{kind:'king',variants:[variant]}},hunt:{},recipes:[]};
test('a closed variant book lends only its exact existing declaration without mutation',()=>{
  const before=structuredClone(boot);validateNalatiEncounterLoans(boot,intake);expect(boot).toEqual(before);
  validateNalatiEncounterLoans(boot,{species:[],recipes:[]});
});
test('missing, foreign, duplicate and changed variant loans refuse',()=>{
  for(const changed of [{...intake,borrowedKinds:['missing']},{...intake,borrowedKinds:['king','king']},
    {...intake,species:[{...species,variants:[{...variant,hp:2399}]}]},
    {...intake,species:[{...species,variants:[{...variant,scale:[-0,1.22] as [number,number]}]}]}])
    expect(()=>validateNalatiEncounterLoans(boot,changed)).toThrow();
  expect(()=>validateNalatiEncounterLoans({...boot,species:{}},intake)).toThrow();
});
test('an existing decision owner cannot be replaced by a recipe loan',()=>{
  expect(()=>validateNalatiEncounterLoans({...boot,hunt:{king:species}},intake)).toThrow();
});
test('always cadence is an explicit admitted species loan',()=>{
  expect(()=>validateNalatiEncounterLoans(boot,{...intake,alwaysKinds:['other']})).toThrow();
  expect(()=>validateNalatiEncounterLoans(boot,{...intake,alwaysKinds:['king','king']})).toThrow();
  expect(()=>validateNalatiEncounterLoans(boot,{...intake,species:[{...species,tick:'ai'}]})).toThrow();
});

test('even an otherwise admitted body recipe cannot be overwritten',()=>{
  const recipe=SIM_LEVEL.entities[0]?.spec;if(recipe===undefined)throw new Error('Missing unplayed recipe');
  expect(()=>validateNalatiEncounterLoans({...boot,recipes:[recipe]},{species:[],recipes:[recipe]})).toThrow('replace');
});
