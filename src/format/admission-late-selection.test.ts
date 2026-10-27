import { expect, test } from 'vitest';
import { entryFileSteps, tierLibrarySteps } from './tierSelection';

const early = 'a'.repeat(64), gallery = 'b'.repeat(64);
function fixture() {
  const manifest = {horizonStrips:{day:early,night:early},explore:{art:{world:gallery}}};
  const files = [early,gallery].map(hash => ({hash,kind:'image',decoded:8,compressed:4,dependencies:[] as string[]}));
  const source = {identity:{slug:'late-selection'},files,critical:[early],library:[early,gallery],late:[{hash:gallery}],manifest};
  const descriptor = {index:{files:files.map(row => ({hash:row.hash,path:`blobs/image/${row.hash}.png`}))},
    sections:new Map<string,unknown>([['ui/level',{manifest}]])};
  return {source,descriptor};
}
function result<T>(steps: Generator<void,T>): T {
  let step = steps.next(); while (step.done !== true) step = steps.next(); return step.value;
}

test('late scheduling hints do not re-admit a manifest-only image', () => {
  const {source,descriptor} = fixture(), {late:_late,...withoutHints} = source;
  expect([...result(entryFileSteps(source,'phone',descriptor))]).toEqual([gallery]);
  expect(result(entryFileSteps(source,'phone',descriptor))).toEqual(result(entryFileSteps(withoutHints,'phone',descriptor)));
});

test('actual critical, dependency and host consumers still pin a late image', () => {
  const {source,descriptor} = fixture();
  source.critical.push(gallery); expect([...result(entryFileSteps(source,'phone',descriptor))]).toEqual([]);
  source.critical.pop(); source.files[0]?.dependencies.push(gallery);
  expect([...result(entryFileSteps(source,'phone',descriptor))]).toEqual([]);
  source.files[0]?.dependencies.pop(); descriptor.sections.set('world/materials',{texture:gallery});
  expect([...result(entryFileSteps(source,'phone',descriptor))]).toEqual([]);
});

test('late scheduling also leaves the existing horizon tier selection unchanged', () => {
  const {source,descriptor} = fixture();
  const manifest = {...source.manifest,horizonStrips:{day:early,night:early,phone:{day:gallery,night:gallery}}};
  const tiered = {...source,critical:[],late:[{hash:early}],manifest};
  descriptor.sections.set('ui/level',{manifest});
  expect([...result(tierLibrarySteps(tiered,'phone',descriptor))]).toEqual([early]);
});
