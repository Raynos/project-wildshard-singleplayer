import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import { emptyShardfile } from '../src/sdk/author';
import { controlFiles, lateFiles } from '../src/game/shardfile/controlFiles';
import { nalatiLatePaintedNames, nalatiDeferredCatalogueScene, nalatiLateDressingNames } from '../src/shards/nalati-grasslands/generators/modelBindings';

test('desktop hints preserve native demand and critical dependency precedence', () => {
  const desktop='world/dressing-desktop.json',phone='world/dressing-phone.json';
  const files=[desktop,phone,'desktop.bin','shared.bin'].map((name,index)=>({name,hash:String(index+1).repeat(64),
    kind:'binary' as const,compressed:7,decoded:7,gpu:0,triangles:0,draws:0,critical:index===1,dependencies:[] as string[]}));
  const scene=emptyShardfile({slug:'desktop-warm',name:'Warm',author:'Fixture',seed:1,revision:1});
  scene.files=files;scene.library=files.map(row=>row.hash);
  const hints=nalatiLateDressingNames(new Map([[desktop,{file:'desktop.bin',shared:'shared.bin'}],[phone,{file:'shared.bin'}]]),new Set(files.map(row=>row.name)),[]);
  scene.late=files.filter(row=>hints.includes(row.name)).map(row=>({hash:row.hash}));
  expect(controlFiles(scene,files).map(row=>row.hash)).toEqual(['2'.repeat(64),'4'.repeat(64)]);
  expect(lateFiles(scene,files).map(row=>row.hash)).toEqual(['1'.repeat(64),'3'.repeat(64)]);
  const first=files[1],needed=files[2];if(first===undefined||needed===undefined)throw new Error('Missing dependency fixture');
  first.dependencies.push(needed.hash);
  expect(controlFiles(scene,files).map(row=>row.hash)).toEqual(['2'.repeat(64),'3'.repeat(64),'4'.repeat(64)]);
  expect(lateFiles(scene,files).map(row=>row.hash)).toEqual(['1'.repeat(64)]);
});

test('catalogue timing stays a closed data declaration with eager absence preserved',()=>{
  const source={name:'timing',catalogues:[{rows:[],materials:{}}],packs:{},geometry:{},materials:{},layers:[],statics:[],animations:[]};
  const eager=v.parse(SceneDressingSchema,source),late=v.parse(SceneDressingSchema,nalatiDeferredCatalogueScene(source));
  expect(eager.catalogues[0]).not.toHaveProperty('load');expect(late.catalogues[0]?.load).toBe('after-control');
  for(const load of ['before-control',null,{},()=>undefined]){
    expect(v.safeParse(SceneDressingSchema,{...source,catalogues:[{...source.catalogues[0],load}]}).success).toBe(false);
  }
});

test('painted alternative hints keep critical and shared dependency overrides', () => {
  const names = ['large.glb', 'small.glb', 'large.ktx2', 'small.ktx2'].map(name => `models/painted/${name}`);
  const entries = names.map((name, index) => ({ name, hash: String(index + 1).repeat(64), kind: 'binary' as const,
    compressed: 7, decoded: 7, gpu: 0, triangles: 0, draws: 0, critical: index === 0, dependencies: [] as string[] }));
  const [large, small, fullAtlas, phoneAtlas] = entries;
  if (large === undefined || small === undefined || fullAtlas === undefined || phoneAtlas === undefined) throw new Error('Missing test entry');
  const owned = (entry: typeof large) => ({ file: entry.name, bytes: entry.compressed });
  const late = nalatiLatePaintedNames({ url: owned(large), phoneUrl: owned(small), atlas: owned(fullAtlas), phoneAtlas: owned(phoneAtlas) });
  const source = emptyShardfile({ slug: 'painted-late', name: 'Painted', author: 'Fixture', seed: 1, revision: 1 });
  source.files = entries; source.library = entries.map(row => row.hash); source.critical = [large.hash];
  source.late = late.map(name => {
    const file = entries.find(row => row.name === name); if (file === undefined) throw new Error('Missing late source');
    return { hash: file.hash };
  });
  const before = structuredClone(source);
  expect(controlFiles(source, entries).map(row => row.hash)).toEqual([large.hash, small.hash, phoneAtlas.hash]);
  expect(lateFiles(source, entries).map(row => row.hash)).toEqual([fullAtlas.hash]);
  expect(source).toStrictEqual(before);
  large.dependencies.push(fullAtlas.hash);
  expect(controlFiles(source, entries)).toEqual(entries);
  expect(lateFiles(source, entries)).toEqual([]);
});
