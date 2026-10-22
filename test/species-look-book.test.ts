import { parse } from 'valibot';
import { NativeSpeciesLookBookSchema } from '@wildshard/format/speciesBookRows';
import { expect,test,vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the admitted packed source bytes through its ordinary fetch port.
import { readFileSync } from 'node:fs';
import { HullLookBook, speciesBehaviour } from '../src/game/looks/speciesBook';
import { Rng } from '../src/engine/core/rng';
import rows from '../src/shards/nalati-grasslands/data/speciesLooks.json' with {type:'json'};
import source from '../src/shards/nalati-grasslands/data/species.generated.json' with {type:'json'};

// G600 L8: the species looks are the hull book's packed looks; the behaviour rows stay outside the look book
test('orchard creature data owns body copies and look identities without control hooks',async()=>{
  const first=rows[0],look0=source.looks.rows[0];if(first===undefined||look0===undefined)throw new Error('Missing packed source fixture');
  const book=new HullLookBook({...source.hullBook,slug:'orchard'}),fetch=vi.spyOn(globalThis,'fetch').mockImplementation(url=>{
    if(url!==source.packedBodies.file)throw new Error('Unexpected body source');
    return Promise.resolve(new Response(new Uint8Array(readFileSync(`public${source.packedBodies.file}`))));
  });
  try{await book.packed.preload();}finally{fetch.mockRestore();}
  const looks=book.packedLooks({poses:source.looks.poses,rows:[{...look0,id:'look.orchard.guard',species:'species.orchard.guard',kind:'orchard-guard'}]});
  const behaviour=speciesBehaviour(parse(NativeSpeciesLookBookSchema,{slug:'orchard',body:source.presentation.packedBodies,rows:[{...first,id:'look.orchard.guard',metadata:{...first.metadata,id:'species.orchard.guard',kind:'orchard-guard',label:'Orchard guardian'}}]}));
  const row=behaviour.rows[0],look=looks.get('orchard-guard'),variant=row?.variants[0];if(variant===undefined)throw new Error('Missing admitted look');
  expect(row?.kind).toBe('orchard-guard');expect(look.species).toBe('species.orchard.guard');expect(look.kind).toBe('orchard-guard');
  const one=look.build(variant,new Rng(3)),two=look.build(variant,new Rng(3));
  expect(one.bones).toEqual(two.bones);expect(one.dims).toEqual(two.dims);expect(one.hardParts[0]).not.toBe(two.hardParts[0]);
  for(const body of [one,two])for(const geometry of [...body.furParts,...body.hardParts,...body.eyeParts])geometry.dispose();
  expect(()=>parse(NativeSpeciesLookBookSchema,{slug:'orchard',body:source.presentation.packedBodies,rows,prepare:()=>undefined})).toThrow();
});
