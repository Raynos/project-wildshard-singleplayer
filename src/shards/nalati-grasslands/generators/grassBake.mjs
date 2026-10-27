// GR6: Nalati's grass at build time (the retired nalati-grass job's construction): the height, mask, field and ground
// lattices and both tiers' blade, flower and card scenes as owned bytes, and the rows that name them. Pure: the caller
// supplies the native lattice and the dressing placements (the cover the grass keeps out of).
import { DataUtils } from 'three';
import { smoothstep } from '@wildshard/sdk/noise';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { bakeMeadowField } from '@wildshard/sdk/bake/meadow';
import { encodePortableBytes } from '@wildshard/sdk/bake/portableBytes';
import view from '../data/grassView.json' with { type: 'json' };
import NALATI_GRASS_LAYOUT from '../data/grassFieldLayout.json' with { type: 'json' };
import { TERRAIN, SEED, RIVER, groundColor } from './terrainRecipe.ts';
import { grassRows } from './grassRows.ts';

/** @param {Uint8Array} terrain the native lattice @param {ReadonlyMap<string, Uint8Array>} placements the dressing placements */
export function nalatiGrassBake(terrain, placements) {
const cover = new Map();
for (const [name,scale] of [['boulder',.9],['slab',1.1],['juniper',.85],['rose',.5],['willow',.4]]) {
  const bytes = placements.get(`dressing-${name}.json`);
  if (bytes === undefined) throw new Error(`Missing native grass keep-outs: ${name}`);
  for (const row of JSON.parse(new TextDecoder().decode(bytes))) { const key = `${Math.floor(row.x/4)},${Math.floor(row.z/4)}`, bucket = cover.get(key) ?? []; bucket.push([row.x,row.z,Math.max(row.sx,row.sz)*scale]);cover.set(key,bucket); }
}
function covered(x,z) { let best=0;for(let a=Math.floor(x/4)-1;a<=Math.floor(x/4)+1;a++)for(let b=Math.floor(z/4)-1;b<=Math.floor(z/4)+1;b++)for(const [cx,cz,r] of cover.get(`${a},${b}`)??[]) { const d=Math.hypot(x-cx,z-cz);if(d<r)best=Math.max(best,Math.min(1,(r-d)/(r*.25))); }return best; }
const native = readNativeTerrain(terrain);
const field = bakeMeadowField({ seed: SEED, half: 250, ...native, trailDistance: TERRAIN.trailDistance,
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
const files = new Map(),sources=[];
const encode = (array,id) => {
  const source=`data/grass-${id}.bin`,name=`look/grass/${id}.bin`;
  files.set(name,encodePortableBytes(new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice(),6));
  sources.push({name,kind:'bin',source,options:{decoded:array.byteLength}});return {file:name};
};
const encodeRows = phone => {
  const tier=phone?'phone':'desktop',file=`look/grass/${tier}-channels.bin`;
  let length=0;
  const rows = grassRows(phone,(_id,bytes)=>{
    const byteOffset=Math.ceil(length/4)*4;length=byteOffset+bytes.byteLength;
    return {file,byteOffset};
  });
  const scenes=Object.fromEntries(Object.entries(rows.scenes).map(([key, scene]) => [key, encode(new TextEncoder().encode(JSON.stringify(scene)),`${tier}-${key}`)]));
  return { ...rows, scenes, channels:{file} };
};
const rows={view,height:encode(height,'height'),mask:encode(mask,'mask'),field:encode(fd,'field'),ground:encode(gd,'ground'),phone:encodeRows(true),desktop:encodeRows(false)};
return { rows: {...rows,sources}, files };
}
