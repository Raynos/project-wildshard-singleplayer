// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { DownloadAccounting, installDownloadAccounting, declareModuleGroups } from '../src/engine/boot/download';
import { declareProductClientModules } from '../src/game/shardfile/clientModules';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';

afterEach(() => { document.body.replaceChildren(); });
function bank(input: unknown): void {
  const element = document.createElement('script'); element.id = 'boot-module-files';
  element.textContent = JSON.stringify({optional:input}); document.body.append(element);
}
test('selected plan graphs reserve exact module bytes before imports without crediting transport', () => {
  bank({files:[['/assets/shared.js',4],['/assets/scenes.js',6],['/assets/meadow.js',8]],groups:{'world.scenes':[0,1],'world.meadow':[0,2]}});
  const source = emptyShardfile({slug:'module-fixture',name:'Modules',author:'Fixture',revision:1,seed:7});
  const product = createShardProduct({slug:source.identity.slug,revision:1,shardfile:source,
    sections:new Map([['client/plan',{version:1,features:[{kind:'world.scenes'}]}]]),files:new Map(),read:()=>Promise.reject(new Error('No read expected'))});
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    declareProductClientModules(product); declareModuleGroups(['world.scenes']);
    expect(accounting.snapshot()).toMatchObject({declaredBytes:10,declaredFiles:2,networkBytes:0,cachedBytes:0});
    declareModuleGroups(['world.meadow']);
    expect(accounting.snapshot()).toMatchObject({declaredBytes:18,declaredFiles:3,networkBytes:0});
  } finally { dispose(); }
});
test('an invalid suffix or missing selected group publishes no prefix', () => {
  bank({files:[['/assets/first.js',4]],groups:{good:[0],bad:[1]}});
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    expect(() => declareModuleGroups(['good','bad'])).toThrow('Missing selected client module file');
    expect(() => declareModuleGroups(['good','absent'])).toThrow('Missing selected client module group');
    expect(accounting.snapshot()).toMatchObject({declaredBytes:0,declaredFiles:0,networkBytes:0});
  } finally { dispose(); }
});

test('overlapping selected graphs publish their bounded file union once', () => {
  const files = Array.from({length:1024}, (_, index) => [`/assets/part-${index}.js`,index+1]);
  const indices = files.map((_, index) => index);
  const kinds = Array.from({length:8}, (_, index) => `feature.${index}`);
  bank({files,groups:{...Object.fromEntries(kinds.map(kind => [kind,indices])),bad:[files.length]}});
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    expect(() => declareModuleGroups([...kinds,'bad'])).toThrow('Missing selected client module file');
    expect(accounting.snapshot()).toMatchObject({declaredFiles:0,declaredBytes:0,networkBytes:0,cachedBytes:0});
    declareModuleGroups(kinds);
    expect(accounting.snapshot()).toMatchObject({declaredFiles:1024,declaredBytes:524800,networkBytes:0,cachedBytes:0});
  } finally { dispose(); }
});
