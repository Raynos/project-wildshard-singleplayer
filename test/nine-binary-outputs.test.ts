// oxlint-disable-next-line import/no-nodejs-modules -- Compare generated binary files with the pre-conversion byte witnesses.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture records hashes, never encoded binary payloads.
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {CAST_BLOBS} from '../src/shards/nine-dragon-stack/generators/castSources';
import {hookProduct} from '../src/shards/nine-dragon-stack/generators/hookProduct';
import hook from '../src/shards/nine-dragon-stack/data/castHook.generated.json' with {type:'json'};
import baseline from './fixtures/nine-binary-outputs.json' with {type:'json'};

const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');
test('every named cast retains its exact original file metadata and GLB bytes',()=>{
  expect(CAST_BLOBS.map(row=>row.file)).toStrictEqual(baseline.castFiles);
  for(const row of baseline.casts){
    const bytes=readFileSync(row.name==='dragon-hook'?`src/shards/nine-dragon-stack/data/${hook.glb}`:`public/assets/nine-dragon/baked/casts/${row.name}.glb`);
    expect(bytes.length,row.name).toBe(row.length);expect(hash(bytes),row.name).toBe(row.hash);
  }
});
test('the hook producer returns the same original GLB and material without encoding it',async()=>{
  const row=await hookProduct(url=>new Uint8Array(readFileSync(`public${url}`))),expected=baseline.casts.find(value=>value.name==='dragon-hook');
  if(expected===undefined)throw new Error('Missing hook byte witness');
  expect(row.glb).toBeInstanceOf(Uint8Array);expect(hash(row.glb)).toBe(expected.hash);expect(row.material).toStrictEqual(hook.material);
});
test('paint retains all compressed chunks byte for byte outside JSON',()=>{
  const bytes=readFileSync('src/shards/nine-dragon-stack/data/paintArray.generated.bin');
  expect(bytes.length).toBe(baseline.paint.length);expect(hash(bytes)).toBe(baseline.paint.hash);
});
