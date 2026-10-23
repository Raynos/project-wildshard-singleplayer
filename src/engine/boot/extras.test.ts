// @vitest-environment happy-dom
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {bootFiles,extraFetches,startDeferredAudioPreload} from './extras';
import {setBootCatalog,type BootLevel} from './catalog';
import {prepareBootAudio} from './audioInventory';
import {declareTotals,type ChunkFiles} from './bytes';
import {installAssetTables,publicBytes,assetVersions,musicManifests,sfxManifests,bootPacks} from './tables';
import {NO_AUDIO,type LevelAudioProfile,type LevelAudioBank} from '../audio/levelAudio';
import type {StepProgress} from './plan';
import * as settings from '../ui/Settings';

const music='/assets/music/folk/title.m4a',sfx='/assets/sfx/field/step.m4a';
const foreignMusic='/assets/music/electronic/other.m4a',foreignSfx='/assets/sfx/other/unused.m4a';
const all={music:[foreignMusic,music],sfx:[foreignSfx,sfx]};
const blank:ChunkFiles={sky:[],baked:[],terrain:[],trees:[],cabins:[],props:[],physics:[],art:[],music:[],sfx:[]};
const level:BootLevel={slug:'fixture',card:{thumb:'data:,',portrait:'data:,',landscape:'data:,'},
  boot:{files:[],sources:()=>blank,audio:[...all.music,...all.sfx]}};
const bank:LevelAudioBank={title:undefined,score:{slots:new Map(),stings:new Map()},cues:{loops:new Map(),shots:new Map()}};
const profile:LevelAudioProfile={files:()=>all,bootFiles:genre=>genre==='folk'?[music,sfx]:[foreignMusic,foreignSfx],decode:()=>Promise.resolve(bank)};
const priorTables={bytes:publicBytes(),versions:assetVersions(),music:musicManifests(),sfx:sfxManifests(),packs:bootPacks()};
beforeEach(()=>{
  setBootCatalog({levels:[level],playable:[level],find:()=>level,artBytes:{}});
  installAssetTables({...priorTables,bytes:{[music]:3,[sfx]:3,[foreignMusic]:100,[foreignSfx]:100}});
  vi.spyOn(settings,'getMusicStyle').mockReturnValue('folk');
});
afterEach(()=>{installAssetTables(priorTables);});

test('boot declares only selected profile audio while background inventory retains every style',async()=>{
  await prepareBootAudio(level.boot);
  const active=bootFiles(level,'img',profile),background=bootFiles(level,'img');
  expect(active.music).toEqual([music]);expect(active.sfx).toEqual([sfx]);
  expect(extraFetches(active)).toEqual([music,sfx]);
  expect(background.music).toEqual(all.music);expect(background.sfx).toEqual(all.sfx);
  expect(declareTotals(active)).toMatchObject({music:{bytes:3,files:1},sfx:{bytes:3,files:1}});
  expect(declareTotals(background)).toMatchObject({music:{bytes:103,files:2},sfx:{bytes:103,files:2}});
  expect(bootFiles(level,'img',NO_AUDIO)).toMatchObject({music:[],sfx:[]});
  vi.mocked(settings.getMusicStyle).mockReturnValue('piano');
  expect(bootFiles(level,'img',profile)).toMatchObject({music:[foreignMusic],sfx:[foreignSfx]});
});

test('preload ignores foreign inventory and decodes selected compressed bytes offline without another fetch',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>Promise.resolve(new Response(new Uint8Array([1,2,3]))));
  const seen:string[]=[],decode=vi.fn<LevelAudioProfile['decode']>(async(style,read)=>{
    expect(style).toBe('folk');
    for(const url of [music,sfx]){
      seen.push(url);const first=await read(url);
      expect(new Uint8Array(first)).toEqual(new Uint8Array([1,2,3]));new Uint8Array(first).fill(9);
      expect(new Uint8Array(await read(url))).toEqual(new Uint8Array([1,2,3]));
    }return bank;
  });
  const preload=startDeferredAudioPreload({...blank,...all},level,{...profile,decode});
  const progress:StepProgress={set:vi.fn<StepProgress['set']>(),detail:()=>undefined};await preload.wait(progress);
  expect(fetch.mock.calls.map(([url])=>url)).toEqual([music,sfx]);
  expect(progress.set).toHaveBeenLastCalledWith(2,2,'2 / 2 audio files');
  fetch.mockImplementation(()=>Promise.reject(new Error('Offline')));
  const decoded=await preload.decode();expect(decoded.profile).toBe(bank);expect(await preload.decode()).toBe(decoded);
  expect(decode).toHaveBeenCalledOnce();expect(seen).toEqual([music,sfx]);expect(fetch).toHaveBeenCalledTimes(2);
});

test('missing audio retains synth fallback and an asset-free profile reads nothing',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>Promise.reject(new Error('Offline')));
  const missing=startDeferredAudioPreload({...blank,...all},level,profile);
  await missing.wait({set:()=>undefined,detail:()=>undefined});expect((await missing.decode()).profile).toBe(bank);
  expect(fetch).toHaveBeenCalledTimes(2);
  const empty=startDeferredAudioPreload({...blank,...all},level,NO_AUDIO);
  await empty.wait({set:()=>undefined,detail:()=>undefined});await empty.decode();
  expect(fetch).toHaveBeenCalledTimes(2);
});
