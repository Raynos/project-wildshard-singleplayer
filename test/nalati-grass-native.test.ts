import {unzlibSync} from 'fflate';
import {expect,test,vi} from 'vitest';
import {parseSceneBuffers} from '../src/format/sceneBuffers';
import {grassRows} from '../src/shards/nalati-grasslands/generators/grassRows';
import {hashImmutableBytes,encodeCanonicalJson} from '../src/sdk/immutable';
import {GRASS_FILES,originalGrassRows} from './fixtures/nalatiGrass';

const hashJson=(value:object):string=>hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));
const originals=[{phone:true},{phone:false}];

for(const original of originals){
  const tier=original.phone?'phone':'desktop';
  test(`${tier} preserves all three native scene declarations`,()=>{
    const rows=originalGrassRows(original.phone);
    for(const [name,scene]of Object.entries(rows.scenes)){
      const compressed=GRASS_FILES.get(`look/grass/${tier}-${name}.bin`);
      if(compressed===undefined)throw new Error('Missing original grass block');
      const current=JSON.parse(new TextDecoder().decode(unzlibSync(compressed))) as unknown;
      const admitted=parseSceneBuffers(current);
      expect(admitted.attributes).toEqual(scene.attributes);expect(admitted.geometries).toEqual(scene.geometries);expect(admitted.draws).toEqual(scene.draws);
    }
  });

  test(`${tier} native publication preserves every channel and metadata field without encoding`,()=>{
    const before=originalGrassRows(original.phone),published=new Map<string,Uint8Array>();
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
    expect(published.size).toBe(inventory.length);expect(rawTotal).toBe(inventory.reduce((sum,row)=>sum+row.bytes,0));expect(expectedOffset).toBe(offset);
    expect(new Set([...published.values()].map(bytes=>bytes.buffer)).size).toBe(published.size);
    expect(hashJson({...rows,scenes:restored})).toBe(hashJson(before));
  });
}

test('publisher mutation and failure cannot change later grass construction',()=>{
  const keys=new Set<string>(),before=new Map(originals.map(({phone})=>[phone,hashJson(originalGrassRows(phone))]));
  for(const {phone}of originals){
    grassRows(phone,(id,bytes)=>{
      expect(keys.has(id)).toBe(false);keys.add(id);bytes.fill(255);
      return {file:'grass/owned.bin',byteOffset:0};
    });
    expect(hashJson(originalGrassRows(phone))).toBe(before.get(phone));
  }
  expect(keys.size).toBe(66);
  expect(()=>grassRows(true,()=>{throw new Error('Publisher retired');})).toThrow('Publisher retired');
  expect(hashJson(originalGrassRows(true))).toBe(before.get(true));
});
