import { expect,test,vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the admitted packed source bytes through its ordinary fetch port.
import { readFileSync } from 'node:fs';
import { SpeciesLookBook } from '../src/game/looks/speciesBook';
import { Rng } from '../src/engine/core/rng';
import rows from '../src/shards/nalati-grasslands/data/speciesLooks.json' with {type:'json'};
import source from '../src/shards/nalati-grasslands/data/species.generated.json' with {type:'json'};

test('orchard creature data owns body copies and look identities without control hooks',async()=>{
  const first=rows[0];if(first===undefined)throw new Error('Missing packed source fixture');
  const input={slug:'orchard',body:source.presentation.packedBodies,poses:source.poses,rows:[{...first,id:'look.orchard.guard',metadata:{...first.metadata,id:'species.orchard.guard',kind:'orchard-guard',label:'Orchard guardian'}}]};
  const book=new SpeciesLookBook(input),fetch=vi.spyOn(globalThis,'fetch').mockImplementation(url=>{
    if(url!==source.packedBodies.file)throw new Error('Unexpected body source');
    return Promise.resolve(new Response(new Uint8Array(readFileSync(`public${source.packedBodies.file}`))));
  });
  try{await book.preloadBodies();}finally{fetch.mockRestore();}
  const row=book.rows[0],look=book.looks[0],variant=row?.variants[0];if(look===undefined||variant===undefined)throw new Error('Missing admitted look');
  expect(row?.kind).toBe('orchard-guard');expect(look.species).toBe('species.orchard.guard');expect(look.kind).toBe('orchard-guard');
  const one=look.build(variant,new Rng(3)),two=look.build(variant,new Rng(3));
  expect(one.bones).toEqual(two.bones);expect(one.dims).toEqual(two.dims);expect(one.hardParts[0]).not.toBe(two.hardParts[0]);
  for(const body of [one,two])for(const geometry of [...body.furParts,...body.hardParts,...body.eyeParts])geometry.dispose();
  expect(()=>new SpeciesLookBook({...input,prepare:()=>undefined})).toThrow();
});
