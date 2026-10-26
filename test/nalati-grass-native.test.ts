import {unzlibSync} from 'fflate';
import {expect,test,vi} from 'vitest';
import {parseSceneBuffers} from '../src/format/sceneBuffers';
import {grassRows} from '../src/shards/nalati-grasslands/generators/grassRows';
import {hashImmutableBytes,encodeCanonicalJson} from '../src/sdk/immutable';
import {GRASS_FILES} from './fixtures/nalatiGrass';

const hashJson=(value:object):string=>hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));
const originals=[
  {phone:true,bytes:2544359,hash:'6817ca04c50157323215b90bf4dffe9573050b2dca0b882aaabeaee056437176',raw:1903422,
    channels:'434797cdf6b5f231caa4d4d221c926ecadbfebc365d8454490db2b5946ab76e9'},
  {phone:false,bytes:5569739,hash:'7d409278e21d6c289e22d7c627c99f54a8e0c96f79b0e9205afdc13b7525c342',raw:4172450,
    channels:'775dc397e6e66030d84b888d46ff6c78faa5255bf01d23a48a5c698ab3c90b74'},
];

for(const original of originals){
  const tier=original.phone?'phone':'desktop';
  test(`${tier} default retains the complete predecessor and all three shipped scene blocks`,()=>{
    const rows=grassRows(original.phone),json=encodeCanonicalJson(rows);
    expect(new TextEncoder().encode(json).byteLength).toBe(original.bytes);
    expect(hashJson(rows)).toBe(original.hash);
    for(const [name,scene]of Object.entries(rows.scenes)){
      const compressed=GRASS_FILES.get(`look/grass/${tier}-${name}.bin`);
      if(compressed===undefined)throw new Error('Missing original grass block');
      expect(JSON.stringify(scene)).toBe(new TextDecoder().decode(unzlibSync(compressed)));
    }
  });

  test(`${tier} native publication preserves every channel and metadata field without encoding`,()=>{
    const before=grassRows(original.phone),published=new Map<string,Uint8Array>();
    let offset=0,rawTotal=0;
    const encoder=vi.spyOn(globalThis,'btoa').mockImplementation(()=>{throw new Error('Native grass must not encode');});
    let rows:ReturnType<typeof grassRows>;
    try{
      rows=grassRows(original.phone,(id,bytes)=>{
        expect(published.has(id)).toBe(false);published.set(id,bytes);
        const byteOffset=Math.ceil(offset/4)*4;offset=byteOffset+bytes.byteLength;rawTotal+=bytes.byteLength;
        return {file:'grass/channels.bin',byteOffset};
      });
      expect(encoder).not.toHaveBeenCalled();
    }finally{encoder.mockRestore();}
    const inventory:{scene:string;id:string;storage:string;instanced:boolean;bytes:number;hash:string}[]=[];
    let expectedOffset=0;
    const restored=Object.fromEntries(Object.entries(rows.scenes).map(([name,scene])=>{
      parseSceneBuffers(scene);
      const prior=Object.entries(before.scenes).find(([key])=>key===name)?.[1];
      if(prior===undefined)throw new Error('Missing original scene');
      const buffers=scene.buffers.map((buffer,index)=>{
        const raw=published.get(`${tier}-${name}-${buffer.id}`),old=prior.buffers[index];
        if(raw===undefined||old?.bytes===undefined)throw new Error('Missing channel');
        const decoded=Uint8Array.from(atob(old.bytes),c=>c.codePointAt(0)??0);
        expect(raw.byteLength).toBe(decoded.byteLength);
        expect(raw.every((value,i)=>value===decoded[i])).toBe(true);
        expect(raw.byteOffset).toBe(0);expect(raw.buffer.byteLength).toBe(raw.byteLength);
        expect(buffer.bytes).toBeUndefined();expect(buffer.file).toBe('grass/channels.bin');
        expect(buffer.byteLength).toBe(raw.byteLength);
        expectedOffset=Math.ceil(expectedOffset/4)*4;expect(buffer.byteOffset).toBe(expectedOffset);expectedOffset+=raw.byteLength;
        inventory.push({scene:name,id:buffer.id,storage:buffer.storage,instanced:buffer.instanced,
          bytes:raw.byteLength,hash:hashImmutableBytes(raw)});
        return {id:buffer.id,storage:buffer.storage,bytes:old.bytes,instanced:buffer.instanced};
      });
      return [name,{...scene,buffers}];
    }));
    expect(published.size).toBe(33);expect(rawTotal).toBe(original.raw);expect(expectedOffset).toBe(offset);
    expect(new Set([...published.values()].map(bytes=>bytes.buffer)).size).toBe(33);
    // The independent predecessor inventory pins every channel identity, type and byte.
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(inventory)))).toBe(original.channels);
    expect(hashJson({...rows,scenes:restored})).toBe(original.hash);
  });
}

test('publisher mutation and failure cannot change later grass construction',()=>{
  const keys=new Set<string>();
  for(const {phone,hash}of originals){
    grassRows(phone,(id,bytes)=>{
      expect(keys.has(id)).toBe(false);keys.add(id);bytes.fill(255);
      return {file:'grass/owned.bin',byteOffset:0};
    });
    expect(hashJson(grassRows(phone))).toBe(hash);
  }
  expect(keys.size).toBe(66);
  expect(()=>grassRows(true,()=>{throw new Error('Publisher retired');})).toThrow('Publisher retired');
  expect(hashJson(grassRows(true))).toBe(originals[0]?.hash);
});
