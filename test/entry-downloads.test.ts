import {expect, test, vi} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the complete output-metadata fixture.
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Address only this fixture's owned files.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin original metadata bytes exactly like the compiler.
import {createHash} from 'node:crypto';
import {emptyShardfile} from '@wildshard/sdk/author';
import {outputSectionPayloads} from '../src/format/outputFields';
import {writeEntryBootstrap} from '../scripts/app-build/entryDownloads';
import {gridEntryDownloads} from '../scripts/app-build/gridEntryDownloads';
import {startGridStripDownload, gridStripDownloadRows} from '../src/game/grid/entryDownloads';

test('plain build schedules exact tier/phase packs and rejects changed section bytes', () => {
  mkdirSync('tmp/entry-downloads', {recursive: true});
  const root = mkdtempSync(resolve('tmp/entry-downloads/compiler-')), product = resolve(root, 'out/example'), out = resolve(root, 'dist');
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  try {
    mkdirSync(product, {recursive: true}); mkdirSync(resolve(out, 'assets'), {recursive: true});
    const source = emptyShardfile({slug: 'example', name: 'Example', author: 'Test', revision: 1, seed: 1});
    const hashes = ['phone', 'desktop', 'late'].map(digest);
    const files = hashes.map((hash, i) => ({hash, kind: 'bin' as const, name: `${i}.bin`, path: `blobs/bin/${hash}.bin`,
      compressed: 3, decoded: 3, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false,
      ...i < 2 ? {tier: i === 0 ? 'phone' as const : 'desktop' as const} : {}}));
    source.files.push(...files.map(({tier: _tier, path: _path, name: _name, ...row}) => ({...row, kind: 'binary' as const})));
    source.library.push(...hashes); source.late = [{hash: hashes[2] ?? ''}];
    source.budgets.library = {compressed: 9, resident: 9};
    const sections = [...outputSectionPayloads(source)].map(([name, value]) => {
      const path = `sections/${name}.json`, text = JSON.stringify(value);
      mkdirSync(resolve(product, path, '..'), {recursive: true}); writeFileSync(resolve(product, path), text);
      return {name, path, bytes: Buffer.byteLength(text), hash: digest(text), schema: `wildshard:${name}@1`};
    });
    const packs = hashes.map((hash, i) => ({path: `blobs/pack/${digest(`pack-${i}`)}.pack`, hash: digest(`pack-${i}`), bytes: 3, entries: [{hash, offset: 0, bytes: 3}]}));
    const index = {format: 'wildshard.shardfile', formatVersion: 2, sdk: '0.2', version: source.version, identity: source.identity,
      build: {sourceHash: digest('source'), validator: 'test'}, requires: source.requires,
      admission: {budgets: source.budgets, serverBudget: source.serverBudget, authorCaps: source.authorCaps,
        critical: source.critical, library: source.library, late: source.late}, sections, schemas: [], files, packs, runtime: null};
    const indexBytes = JSON.stringify(index); writeFileSync(resolve(product, 'shard.json'), indexBytes);
    writeFileSync(resolve(out, 'index.html'), '<head><script type="application/json" id="boot-module-files">{"common":[]}</script></head>');
    writeEntryBootstrap(out, root);
    const html = readFileSync(resolve(out, 'index.html'), 'utf8'), match = /id="boot-module-files">([^<]+)</u.exec(html);
    const bank: unknown = JSON.parse(match?.[1] ?? 'null');
    if (typeof bank !== 'object' || bank === null) throw new Error('Missing complete compiler bank');
    const entries: unknown = Reflect.get(bank, 'entryDownloads'), indexes: unknown = Reflect.get(bank, 'entryIndexes');
    if (typeof entries !== 'object' || entries === null || typeof indexes !== 'object' || indexes === null) throw new Error('Missing entry compiler facts');
    expect(Reflect.get(indexes, 'example')).toBe(`/shardfiles/example/shard.json?v=${digest(indexBytes).slice(0, 8)}`);
    const pair: unknown = Reflect.get(entries, 'example');
    if (typeof pair !== 'object' || pair === null) throw new Error('Missing tier pair');
    for (const [tier, included, excluded] of [['phone', 0, 1], ['desktop', 1, 0]] as const) {
      const path: unknown = Reflect.get(pair, tier); if (typeof path !== 'string') throw new Error('Missing tier schedule');
      const text = readFileSync(resolve(out, path.slice(1)), 'utf8');
      expect(text).toContain(packs[included]?.path); expect(text).not.toContain(packs[excluded]?.path); expect(text).not.toContain(packs[2]?.path);
    }
    expect(html).toContain('installEntryTransport();'); expect(html).not.toContain('export function');
    const first = sections[0]; if (first === undefined) throw new Error('Missing original section');
    writeFileSync(resolve(product, first.path), '{}');
    expect(() => writeEntryBootstrap(out, root)).toThrow('Entry section differs from index');
  } finally {rmSync(root, {recursive: true, force: true});}
});

test('grid tap selects only its original mode/home page, never outer or another layout', () => {
  mkdirSync('tmp/entry-downloads', {recursive: true});
  const root=mkdtempSync(resolve('tmp/entry-downloads/grid-')),folder=resolve(root,'out/.app');
  const digest=(value:string):string=>createHash('sha256').update(value).digest('hex');
  try {
    mkdirSync(resolve(folder,'grid-strip-pages'),{recursive:true});
    const source=digest('layout'),other=digest('other-layout');
    const header={url:`/assets/grid-strip-page-${digest('header').slice(0,8)}.json`,bytes:3,sha256:digest('header')};
    const body={url:`/assets/grid-strip-mesh-${digest('body').slice(0,8)}.bin`,bytes:3,sha256:digest('body')};
    const text=JSON.stringify({version:1,pages:[{source,home:'example',header,body},{source,home:'example:outer',header,body}]});
    const directory={url:`/assets/grid-strip-book-${digest(text).slice(0,8)}.json`,bytes:Buffer.byteLength(text),sha256:digest(text)};
    writeFileSync(resolve(folder,'grid-strip-pages',directory.url.split('/').at(-1)??''),text);
    writeFileSync(resolve(folder,'grid-strip-index.json'),JSON.stringify({geometry:{directory,homes:['example','example:outer']}}));
    writeFileSync(resolve(folder,'grid-strip-entry-modes.json'),JSON.stringify({'100':source,'000':other}));
    const rows=gridEntryDownloads(root);
    expect(rows['100']).toEqual({example:[directory,header,body]});expect(rows['000']).toEqual({});
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    vi.stubGlobal('document',{getElementById:()=>({textContent:JSON.stringify({gridEntryDownloads:rows})})});
    const read=vi.spyOn(globalThis,'fetch').mockImplementation(()=>Promise.resolve(new Response(new Uint8Array([1,2,3]))));
    try {
      expect(gridStripDownloadRows({developer:true,devserver:false,nineDragon:false},'example')).toEqual([directory,header,body].map(({url,bytes})=>({url,bytes})));
      expect(read).not.toHaveBeenCalled();
      startGridStripDownload({developer:false,devserver:false,nineDragon:false},'example');expect(read).not.toHaveBeenCalled();
      startGridStripDownload({developer:true,devserver:false,nineDragon:false},'example');
      expect(read.mock.calls.map(([url])=>url)).toEqual([directory.url,header.url,body.url]);
      for(const [,options]of read.mock.calls)expect(options).toMatchObject({keepalive:true,priority:'low'});
      startGridStripDownload({developer:true,devserver:false,nineDragon:false},'example:outer');expect(read).toHaveBeenCalledTimes(3);
      vi.stubGlobal('document',{getElementById:()=>({textContent:JSON.stringify({gridEntryDownloads:{'100':{example:[directory,header,{url:'/outside.bin',bytes:1}]}}})})});
      expect(gridStripDownloadRows({developer:true,devserver:false,nineDragon:false},'example')).toEqual([]);
      startGridStripDownload({developer:true,devserver:false,nineDragon:false},'example');expect(read).toHaveBeenCalledTimes(3);
    }finally{
      if (previousDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
      else Object.defineProperty(globalThis, 'document', previousDocument);
      read.mockRestore();
    }
    writeFileSync(resolve(folder,'grid-strip-pages',directory.url.split('/').at(-1)??''),'{}');
    expect(()=>gridEntryDownloads(root)).toThrow('Grid entry directory differs');
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('grid metadata can cross navigation while geometry waits for code and stays document-owned', () => {
  const directory = {url: '/assets/grid-strip-book-aaaaaaaa.json', bytes: 3};
  const header = {url: '/assets/grid-strip-page-bbbbbbbb.json', bytes: 3};
  const body = {url: '/assets/grid-strip-mesh-cccccccc.bin', bytes: 3};
  const mode = {developer: true, devserver: false, nineDragon: false};
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  vi.stubGlobal('document', {getElementById: () => ({textContent: JSON.stringify({gridEntryDownloads: {'100': {example: [directory, header, body]}}})})});
  const read = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]))));
  try {
    startGridStripDownload(mode, 'example', 'metadata');
    expect(read.mock.calls.map(([url]) => url)).toEqual([directory.url, header.url]);
    expect(read.mock.calls.every(([, options]) => options?.keepalive === true && options.priority === 'low')).toBe(true);
    // The composition root calls this phase only after its code barrier.
    startGridStripDownload(mode, 'example', 'mesh');
    expect(read.mock.calls.map(([url]) => url)).toEqual([directory.url, header.url, body.url]);
    expect(read.mock.calls[2]?.[1]).toMatchObject({keepalive: false, priority: 'low'});
  } finally {
    if (previousDocument === undefined) Reflect.deleteProperty(globalThis, 'document');
    else Object.defineProperty(globalThis, 'document', previousDocument);
    read.mockRestore();
  }
});
