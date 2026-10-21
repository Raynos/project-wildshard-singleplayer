import {expect,test} from 'vitest';
import {parse} from 'valibot';
import {BowVariantSchema} from '../src/format/bowVariantRows';
import rows from '../src/shards/nalati-grasslands/boot/bowVariant.generated.json' with {type:'json'};

test('the variant baker preserves its admitted payload without native validation',()=>{
  expect(parse(BowVariantSchema,rows)).toEqual(rows);
  for(const bad of [
    {...rows,id:'not-a-weapon'},
    {...rows,drawSpeed:0},
    {...rows,flight:{...rows.flight,step:0}},
    {...rows,sourceTag:'undotted'},
    {...rows,style:'not-a-native-style'},
    {...rows,program:{...rows.program,bytes:42}},
  ])expect(()=>parse(BowVariantSchema,bad)).toThrow();
});
