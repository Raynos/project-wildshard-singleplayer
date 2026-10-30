import { parseManifestMetadata } from '../src/format/minimap';
import metadata from '../src/shards/nalati-grasslands/manifest.json' with { type: 'json' };
import { expect,test } from 'vitest';

test('authored declared entry keeps its exact platform and refuses unknown fields',()=>{
  const data=parseManifestMetadata(metadata),entry=data.bindings.entry;
  expect(entry).toEqual({platform:'client-plan',retainHomeRuntime:true,stagesOwner:'declared'});
  const nativeEntry={native:{module:'./runtime/index',export:'NalatiPlugin'},retainHomeRuntime:true,stagesOwner:'declared'};
  const withEntry=(value:unknown)=>({...metadata,bindings:{...metadata.bindings,entry:value}});
  // Authored metadata cannot reintroduce a native entry; frozen runtime schemas stay separate.
  expect(()=>parseManifestMetadata(withEntry(nativeEntry))).toThrow();
  for(const nativePlan of [{phases:['play'],features:['unknown']},{phases:['play'],features:['weather.forest','weather.forest']},{phases:['play','play']}])
    expect(()=>parseManifestMetadata(withEntry({...nativeEntry,nativePlan}))).toThrow();
  for(const invalid of [{...entry,platform:'unknown'},{...entry,nativePlan:true},{...entry,execute:true}])
    expect(()=>parseManifestMetadata(withEntry(invalid))).toThrow();
  expect(()=>parseManifestMetadata({...metadata,bindings:{...metadata.bindings,groundRows:{...metadata.bindings.groundRows,execute:true}}})).toThrow();
});
