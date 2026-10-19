import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { zlibSync } from 'fflate';
import { DataUtils } from 'three';
import { smoothstep } from '@wildshard/engine/core/noise';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { GrassField } from '@wildshard/game/systems/looks/grassField';
import { NALATI_GRASS_LAYOUT } from './grassFieldLayout.ts';
import { TERRAIN, SEED, RIVER, groundColor } from './terrainRecipe.ts';
import { grassRows } from './grassRows.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const view = JSON.parse(readFileSync(new URL('../data/grassView.json',import.meta.url),'utf8'));
const cover = new Map();
for (const [name,scale] of [['boulder',.9],['slab',1.1],['juniper',.85],['rose',.5],['willow',.4]]) for (const row of JSON.parse(readFileSync(new URL(`../data/dressing-${name}.generated.json`,import.meta.url),'utf8'))) { const key = `${Math.floor(row.x/4)},${Math.floor(row.z/4)}`, bucket = cover.get(key) ?? []; bucket.push([row.x,row.z,Math.max(row.sx,row.sz)*scale]);cover.set(key,bucket); }
function covered(x,z) { let best=0;for(let a=Math.floor(x/4)-1;a<=Math.floor(x/4)+1;a++)for(let b=Math.floor(z/4)-1;b<=Math.floor(z/4)+1;b++)for(const [cx,cz,r] of cover.get(`${a},${b}`)??[]) { const d=Math.hypot(x-cx,z-cz);if(d<r)best=Math.max(best,Math.min(1,(r-d)/(r*.25))); }return best; }
const native = readNativeTerrain(readFileSync(fileURLToPath(new URL('../../../../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url))));
const field = new GrassField({ seed: SEED, half: 250, ...native, trailDistance: TERRAIN.trailDistance,
  cabinMask: TERRAIN.cabinMask, pondMask: TERRAIN.pondMask, waterLevel: TERRAIN.waterLevel,
  paint: (x,z,y,slope,out) => { groundColor(x,z,y,slope,TERRAIN,out); return true; },
  layout: { ...NALATI_GRASS_LAYOUT, riverZ: RIVER.z, riverHalf: RIVER.half } });
const height = new Uint16Array(512 * 512), mask = new Uint8Array(512 * 512 * 4), fd = new Uint8Array(126 * 126 * 4), gd = new Uint8Array(fd.length);
for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
  const x = -256+i+.5, z = -256+j+.5, k = (j*512+i)*4;
  height[j*512+i] = DataUtils.toHalfFloat(native.heightAt(x,z));
  const td = TERRAIN.trailDistance(x,z), full = field.trailGrass(1,td), capped = field.trailGrass(.22,td);
  const edge = Math.min(1,capped/.22), verge = edge <= 1e-4 ? 0 : Math.max(0,Math.min(1,(full-capped)/(.78*edge)));
  const cut = field.baseHeightAt(x,z,Infinity) <= 0 ? 0 : edge*smoothstep(.35,.6,native.splatAt(x,z)[0]);
  mask[k] = Math.round(Math.round(cut*255)*(1-covered(x,z))); mask[k+1] = Math.round(verge*255); mask[k+3] = 255;
}
for (let j = 0; j < 126; j++) for (let i = 0; i < 126; i++) {
  const x = i*4-250, z = j*4-250, k = (j*126+i)*4;
  const values = [field.baseHeightAt(x,z,Infinity)/1.5,field.sample(x,z,1),field.sample(x,z,7),field.sample(x,z,3)];
  values.forEach((value,c) => { fd[k+c] = Math.round(Math.min(1,Math.max(0,value))*255); });
  for (let c = 0; c < 3; c++) gd[k+c] = Math.round(Math.min(1,field.sample(x,z,c+4))*255);
  gd[k+3] = 255;
}
const encode = array => Buffer.from(zlibSync(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))).toString('base64');
const encodeRows = phone => {
  const rows = grassRows(phone);
  return { ...rows, scenes: Object.fromEntries(Object.entries(rows.scenes).map(([key, scene]) => [key, encode(new TextEncoder().encode(JSON.stringify(scene)))])) };
};
const writer = byteWriter(process.argv.includes('--check'), 'nalati-grass');
writer.put(resolve(import.meta.dirname, '..', 'boot', 'grass.generated.json'), jsonBytes({ view, height: encode(height), mask: encode(mask), field: encode(fd), ground: encode(gd), phone: encodeRows(true), desktop: encodeRows(false) }, 0));
writer.finish();
