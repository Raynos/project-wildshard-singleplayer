import {expect,test} from 'vitest';
import {parse} from 'valibot';
import {BowVariantSchema,BowSourceMultipliersSchema} from '../src/format/bowVariantRows';
import {sourceMultiplier} from '../src/engine/combat/effects/types';
import effects from '../src/shards/nalati-grasslands/data/weaponEffects.json' with {type:'json'};
import rows from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};

test('the variant baker preserves its admitted payload without native validation',()=>{
  expect(parse(BowVariantSchema,rows)).toEqual(rows);
  for(const bad of [
    {...rows,id:'not-a-weapon'},
    {...rows,drawSpeed:0},
    {...rows,flight:{...rows.flight,step:0}},
    {...rows,sourceTag:'undotted'},
    {...rows,damageScale:{base:[1,Number.NaN],kinds:{}}},
    {...rows,damageScale:{base:[1,1,1],kinds:{}}},
    {...rows,damageScale:{base:[1,1],kinds:{balbal:[-1,1]}}},
    {...rows,style:'not-a-native-style'},
    {...rows,program:{...rows.program,bytes:42}},
  ])expect(()=>parse(BowVariantSchema,bad)).toThrow();
});


test('baked damage columns equal the original tag law for every native target and unknown kind',()=>{
  const multipliers=parse(BowSourceMultipliersSchema,effects.multipliers);
  const kinds=['balbal','kurgan-balbal','horse','argymaq','wolf','sheep','marmot','eagle','golden-king','qyran','qara-batyr','storm-titan','unknown','constructor','__proto__'];
  for(const kind of kinds)for(const sun of [false,true])for(const previous of [-2,-0,0,.1,1,2,Math.PI]){
    const expected=previous*sourceMultiplier(multipliers,{weaponTags:[rows.id],sourceTags:sun?[rows.sourceTag]:[],targetTags:[`creature.${kind}`]});
    const scales=Object.hasOwn(rows.damageScale.kinds,kind)?rows.damageScale.kinds[kind]:undefined;
    expect(previous*(scales??rows.damageScale.base)[sun?1:0]).toBe(expected);
  }
});
