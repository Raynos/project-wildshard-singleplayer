import { parseManifestMetadata } from '../src/format/minimap';
import metadata from '../src/shards/nalati-grasslands/manifest.json' with { type: 'json' };
import { expect,test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the exact build-only manifest declaration fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the registered build-only input catalogue.
import { mkdirSync,mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { manifestDeclaration } from '../scripts/manifest-declaration.mjs';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { discoverGeneration,generateShardJob } from '../scripts/generate.mjs';
import { NALATI_MANIFEST_ROWS as original } from './fixtures/originalNalatiManifestRows';
import rows from '../src/shards/nalati-grasslands/data/manifestRows.json' with { type:'json' };
import { skyRows } from '../src/shards/nalati-grasslands/generators/skyPresentation';
import { nalatiDayClockRow } from '../src/shards/nalati-grasslands/generators/dayClock';
// oxlint-disable-next-line import/no-nodejs-modules -- Pin the original ordered literal bytes during this data migration.
import { createHash } from 'node:crypto';

test('Nalati fixed manifest data preserves every ordered authored value',()=>{
  expect(JSON.stringify(rows)).toBe(JSON.stringify(original));
  expect(createHash('sha256').update(JSON.stringify(rows)).digest('hex')).toBe('cff1f5fd8aea27bf59f6394035b78f549496af96e02186605fd2144c0da3558f');
  expect(manifestDeclaration(resolve('.'),'nalati-grasslands',rows,[])).toBe(manifestDeclaration(resolve('.'),'nalati-grasslands',original,[]));
});

test('clock and painted sky keep the original numeric input and RGB tuples',()=>{
  const sun=original.sky.sun,x=Math.PI-Math.asin(Math.min(1,Math.max(-1,sun.elevation/58))),hour=6+x*12/Math.PI;
  expect(nalatiDayClockRow()).toMatchObject({units:'hour',start:hour,sun:{maxElevation:58,azimuthOffset:sun.azimuth-(90+(hour-6)*15)}});
  const actual=skyRows().day;
  expect(actual.sun).toStrictEqual(original.sky.sunColor);expect(actual.vol).toStrictEqual(original.atmosphere.volumetricSunColor);
  expect(actual.zenith).toStrictEqual(original.sky.painted.zenith);expect(actual.horizon).toStrictEqual(original.sky.painted.horizon);
  expect(actual.shadowTint).toStrictEqual(original.grade.shadowTint);expect(actual.highTint).toStrictEqual(original.grade.highTint);
  expect(actual.lift).toStrictEqual(original.grade.lift);expect(actual.gain).toStrictEqual(original.grade.gain);
});

test('both existing manifest consumers track the literal producer input',()=>{
  const catalogue:unknown=JSON.parse(readFileSync('scripts/generation-jobs.json','utf8'));
  if(catalogue===null||typeof catalogue!=='object'||!('jobs' in catalogue)||!Array.isArray(catalogue.jobs))throw new Error('Missing generation catalogue');
  const jobs=catalogue.jobs.filter((row:unknown)=>row!==null&&typeof row==='object'&&'inputRoots' in row&&Array.isArray(row.inputRoots)&&row.inputRoots.includes('src/shards/nalati-grasslands/data/manifestRows.json'));
  expect(jobs).toHaveLength(2);
});

test('cold boot metadata publishes canonical discovery for terrain and commit snapshots',async()=>{
  const root=resolve('.'),job=discoverGeneration(root).jobs.find(row=>row.id==='nalati-boot-metadata');
  if(job===undefined)throw new Error('Missing Nalati boot producer');
  const file='src/shards/nalati-grasslands/discovery.generated.ts';
  expect(job.outputs).toContain(file);expect(job.buildTimeOutputs).toContain(file);
  expect(job.inputRoots).toEqual(expect.arrayContaining([
    'scripts/authored-manifest.mjs','src/shards/nalati-grasslands/manifest.json',
    'src/shards/nalati-grasslands/boot/geography.generated.json',
  ]));
  expect(job.inputRoots).not.toContain('src/shards/nalati-grasslands/data/navigation.generated.json');
  mkdirSync('tmp',{recursive:true});const cache=mkdtempSync(resolve('tmp/nalati-discovery-proof-'));
  try {
    const result=await generateShardJob(root,job,{cacheDir:cache});
    try {
      expect(result.hit).toBe(false);
      expect(readFileSync(resolve(result.directory,file),'utf8')).toBe(authoredManifestSource(root,'nalati-grasslands'));
    } finally {result.release();}
  } finally {rmSync(cache,{recursive:true,force:true});}
});


test('authored native entry keeps its exact compiled selection and refuses unknown fields',()=>{
  const data=parseManifestMetadata(metadata),entry=data.bindings.entry;
  expect(entry).toEqual({native:{module:'./runtime/index',export:'NalatiPlugin'},retainHomeRuntime:true,stagesOwner:'declared',
    nativePlan:{phases:['world','world-bindings','kit','prepare-play','play'],features:['world.assembly','state.adventure','species.program','weather.forest','held.claims.prepare','held.claims.install','debug.expose','taming.entry','arena-room.entry','elite.entry','stealth.entry','quest.chapter-view']}});
  expect(data.loadout).toEqual(original.loadout);expect(data.hud).toEqual(original.hud);expect(data.bag).toEqual(original.bag);
  for(const nativePlan of [{phases:['play'],features:['unknown']},{phases:['play'],features:['weather.forest','weather.forest']},{phases:['play','play']}])
    expect(()=>parseManifestMetadata({...metadata,bindings:{...metadata.bindings,entry:{...metadata.bindings.entry,nativePlan}}})).toThrow();
  expect(()=>parseManifestMetadata({...metadata,bindings:{...metadata.bindings,groundRows:{...metadata.bindings.groundRows,execute:true}}})).toThrow();
});
