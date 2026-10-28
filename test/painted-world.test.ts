import {GRASS_FILES} from './fixtures/nalatiGrass';
import * as THREE from 'three';
import { afterEach, expect, test } from 'vitest';
import * as v from 'valibot';
import { paintedWorld, paintedWorldOf, postGraphLook } from '../src/game/looks/postGraphLook';
import { PaintedWorldSchema } from '../src/format/postGraphLook';
import { NALATI_PAINTED as paintedTextures } from '../src/shards/nalati-grasslands/generators/paintedRows';
import { nalatiSpecimens as specimenData } from './fixtures/nalati-specimens';
import { GrassPresentationSchema, grassPresentationFiles } from '../src/format/fieldPresentation';
import { TIER } from '../src/engine/core/tier';
import capture from '../src/shards/nalati-grasslands/data/staticCapture.json' with { type: 'json' };
import { nalatiGrassJson } from './fixtures/nalati-grass-bake';

const grassRows=v.parse(GrassPresentationSchema,
  nalatiGrassJson());

// A made-up moor (the painted world's fixture level): its own fog ramp, LUT and drifting cloud shadows over painted ground
// and grass rows (the boot rows of the first level, which the moor borrows for its ground and blades).
const chunks = { ...THREE.ShaderChunk };
afterEach(() => { Object.assign(THREE.ShaderChunk, chunks); });
const moor = () => ({ fog: { start: 40, end: 900, haze: [0.3, 0.32, 0.36], aerial: [0.002, 40, -5, 0.001], edge: [0.9, 251, 270, 15], order: 280, lut: [0.5, 0.55, 0.6, 0.52, 0.56, 0.6] },
  air: { tile: 800, threshold: 0.6, strength: 0.4, softness: 0.1, drift: [1, 0.5] }, ground: 'ground' in paintedTextures ? paintedTextures.ground : null, tiles: specimenData.materials,
  capture, grass: { rows: grassRows, cards: { url: '/assets/moor/cards.webp', phoneUrl: '/assets/moor/cards.phone.webp', name: 'moor-cards' } } });

test('a painted world refuses executable or malformed rows', () => {
  expect(v.safeParse(PaintedWorldSchema, moor()).success).toBe(true);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), fog: { ...moor().fog, lut: [0.5, 0.5] } }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), fog: { ...moor().fog, start: Number.NaN } }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), build: () => undefined }).success).toBe(false);
  expect(v.safeParse(PaintedWorldSchema, { ...moor(), grass: { ...moor().grass, cards: { url: 'https://example.com/a.webp', phoneUrl: '/a.webp', name: 'a' } } }).success).toBe(false);
});

test('a level builds its painted world once a page and its world wiring reads the same parts by slug', () => {
  expect(() => paintedWorldOf('moor')).toThrow('No painted world for moor');
  const parts = paintedWorld('moor', moor(),GRASS_FILES);
  expect(paintedWorld('moor', moor())).toBe(parts);
  expect(paintedWorldOf('moor')).toBe(parts);
  expect(parts.fogLut.image.width).toBe(2);
  expect(parts.look.fog.order).toBe(280);
  expect([parts.look.sky.clouds, parts.look.sky.planet, parts.look.sky.ownSky]).toEqual([false, false, true]);
  expect(typeof parts.look.terrainPainter.build).toBe('function');
  expect(parts.grass.input.view.trail.speedLimit).toBeGreaterThan(0);
  parts.look.fog.install();
  expect(THREE.ShaderChunk.fog_pars_fragment.split('float pCloudShadow()').length).toBe(2);
});

const rawLook = () => ({passes:{},sides:[],composite:{pass:'frame',output:'out'},inputs:{},uniforms:{},painted:moor()});
test('product look awaits every selected grass file through its original receiver before publishing',async()=>{
  const reads:string[]=[],product={slug:'raw-grass-world',json:()=>Promise.resolve(rawLook()),file(name:string):Promise<Uint8Array>{
    expect(this).toBe(product);reads.push(name);const bytes=GRASS_FILES.get(name);
    if(bytes===undefined)throw new Error(`Missing grass file ${name}`);return Promise.resolve(bytes);
  }};
  await postGraphLook(product,{file:'look/post.json',field:[]});
  const selected=grassPresentationFiles(grassRows,TIER),other=TIER==='phone'?'desktop':'phone';
  expect(reads).toEqual(selected);
  for(const sourceName of grassPresentationFiles(grassRows,other).filter(candidate=>!selected.includes(candidate)))expect(reads).not.toContain(sourceName);
  expect(paintedWorldOf(product.slug).grass.input.view).toEqual(grassRows.view);
});
test.each(['json','file'] as const)('product look refuses replaced %s across raw intake before publication',async key=>{
  let finish:(value:Uint8Array)=>void=()=>{throw new Error('Missing pending reader');};
  const pending=new Promise<Uint8Array>(resolve=>{finish=resolve;}),bytes=GRASS_FILES.values().next().value;
  if(bytes===undefined)throw new Error('Missing grass bytes');
  const product={slug:`pending-grass-${key}`,json:()=>Promise.resolve(rawLook()),file:()=>pending};
  const intake=postGraphLook(product,{file:'look/post.json',field:[]});await Promise.resolve();
  if(key==='json')product.json=()=>Promise.resolve(rawLook());else product.file=()=>Promise.resolve(bytes);
  finish(bytes);await expect(intake).rejects.toThrow('reader changed');expect(()=>paintedWorldOf(product.slug)).toThrow('No painted world');
});
test('a raw look refuses an absent file reader before publishing',async()=>{
  const product={slug:'missing-grass-reader',json:()=>Promise.resolve(rawLook())};
  await expect(postGraphLook(product,{file:'look/post.json',field:[]})).rejects.toThrow('file reader required');
  expect(()=>paintedWorldOf(product.slug)).toThrow('No painted world');
});
