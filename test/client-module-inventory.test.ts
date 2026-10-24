// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { DownloadAccounting, installDownloadAccounting, declareModuleGroups, preloadModuleFiles, preloadModuleGroups } from '../src/engine/boot/download';
import { declareProductClientModules, prepareClientModuleGroups } from '../src/game/shardfile/clientModules';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';

afterEach(() => { document.body.replaceChildren(); for (const link of document.querySelectorAll('link[rel="modulepreload"]')) link.remove(); });
function bank(input: unknown): void {
  const element = document.createElement('script'); element.id = 'boot-module-files';
  element.textContent = JSON.stringify({optional:input}); document.body.append(element);
}
test('warm module groups reuse private parsing but publish to each loading ledger', () => {
  bank({files:[['/assets/parser.js',8]],groups:{'models.gltf':[0]}});
  const parse = vi.spyOn(JSON, 'parse');
  try {
    for (let i = 0; i < 2; i++) {
      const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
      try {
        declareModuleGroups(['models.gltf']); declareModuleGroups(['models.gltf']);
        expect(accounting.snapshot()).toMatchObject({declaredBytes:8,declaredFiles:1,networkBytes:0,cachedBytes:0});
      } finally { dispose(); }
    }
    expect(parse).toHaveBeenCalledTimes(1);
  } finally { parse.mockRestore(); }
});

test('changed module text revalidates unselected files before publishing anything', () => {
  bank({files:[['/assets/parser.js',8]],groups:{'models.gltf':[0]}});
  declareModuleGroups(['models.gltf']);
  const element = document.getElementById('boot-module-files');
  if (element === null) throw new Error('Missing test module bank');
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    element.textContent = JSON.stringify({optional:{files:[['/assets/parser.js',8],['https://foreign.invalid/a.js',9]],groups:{'models.gltf':[0]}}});
    expect(() => declareModuleGroups(['models.gltf'])).toThrow('Invalid boot module file');
    expect(accounting.snapshot()).toMatchObject({declaredBytes:0,declaredFiles:0});
    element.textContent = JSON.stringify({optional:{files:[['/assets/new.js',12]],groups:{'models.gltf':[0],bad:[1]}}});
    expect(() => declareModuleGroups(['models.gltf','bad'])).toThrow('Missing selected client module file');
    expect(accounting.snapshot()).toMatchObject({declaredBytes:0,declaredFiles:0});
    declareModuleGroups(['models.gltf']);
    expect(accounting.snapshot()).toMatchObject({declaredBytes:12,declaredFiles:1});
  } finally { dispose(); }
});

test('replacement module elements get their own complete admission', () => {
  const input = {files:[['/assets/parser.js',8]],groups:{'models.gltf':[0]}};
  bank(input);
  const parse = vi.spyOn(JSON, 'parse');
  try {
    declareModuleGroups(['models.gltf']);
    document.body.replaceChildren(); bank(input);
    declareModuleGroups(['models.gltf']);
    expect(parse).toHaveBeenCalledTimes(2);
  } finally { parse.mockRestore(); }
});

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


test('selected preloads start together without importing code or inventing completion', () => {
  bank({files:[['/assets/shared.js',4],['/assets/scenes.js',6],['/assets/unused.js',8],['/assets/styles.css',2]],
    groups:{'world.scenes':[0,1,3],unused:[2]}});
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    preloadModuleGroups(['world.scenes']); preloadModuleGroups(['world.scenes']);
    expect([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map(link => new URL(link.href).pathname)).toEqual(['/assets/shared.js','/assets/scenes.js']);
    expect(accounting.snapshot()).toMatchObject({declaredFiles:3,declaredBytes:12,networkBytes:0,cachedBytes:0});
    expect(document.querySelectorAll('script[src]')).toHaveLength(0);
    preloadModuleFiles([['/assets/direct.js',5]]);
    expect(document.querySelector('link[href$="/assets/direct.js"]')?.getAttribute('crossorigin')).toBe('anonymous');
  } finally { dispose(); }
});

test('invalid selected suffixes create no preload or declaration prefix', () => {
  bank({files:[['/assets/first.js',4]],groups:{good:[0],bad:[1]}});
  const accounting = new DownloadAccounting(document.baseURI), dispose = installDownloadAccounting(accounting);
  try {
    expect(() => preloadModuleGroups(['good','bad'])).toThrow('Missing selected client module file');
    expect(() => preloadModuleFiles([['/assets/first.js',4],['https://foreign.invalid/second.js',4]])).toThrow('Invalid boot module file');
    expect(document.querySelectorAll('link[rel="modulepreload"]')).toHaveLength(0);
    expect(accounting.snapshot()).toMatchObject({declaredFiles:0,declaredBytes:0,networkBytes:0});
  } finally { dispose(); }
});

test('verified plan metadata prepares only its selected feature and actual loadout graphs', () => {
  bank({files:[['/assets/scenes.js',4],['/assets/explorer.js',6],['/assets/parser.js',8],['/assets/meadow.js',10]],
    groups:{'world.scenes':[0],'explorer.catalogue':[1],'models.gltf':[2],'world.meadow':[3]}});
  const source = emptyShardfile({slug:'module-fixture',name:'Modules',author:'Fixture',revision:1,seed:7});
  const sections = new Map<string,unknown>([['client/plan',{version:1,features:[{kind:'world.scenes'}]}],['explore/catalogue',{version:1,entries:[]}]]);
  prepareClientModuleGroups(source,sections);
  expect([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map(link => new URL(link.href).pathname)).toEqual(['/assets/scenes.js','/assets/explorer.js']);
  source.rows.looks.push({id:'look.test',species:'species.test',recipe:'platform.skin',material:null,parameters:{skin:'a'.repeat(64)},animation:{recipe:'platform.clips',parameters:{}}});
  prepareClientModuleGroups(source,sections);
  expect([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]')].map(link => new URL(link.href).pathname)).toEqual(['/assets/scenes.js','/assets/explorer.js','/assets/parser.js']);
  expect(document.querySelector('link[href$="meadow.js"]')).toBeNull();
});
