// Node-only adaptive lattice receipt. Profiles use committed WSTR heights and the same linearised
// ground palette functions as edgeSources. Entry/water observations are intentionally excluded;
// draw calls, shadows and per-view triangles belong to the renderer receipt.
// Run from the repository root: node --import ./scripts/sim-node-loader.mjs progress/shard-platform/sf17b/adaptive-lattice.mjs
import { readFileSync } from 'node:fs';
import { generatePlatform } from '../../../src/engine/sim/strips.ts';
import { nativeEdgeProfiles } from '../../../src/engine/sim/edgeProfiles.ts';
import { GridAssembly } from '../../../src/game/grid/assembly.ts';
import source from '../../../src/shards/_template/shard.config.ts';
import { NALATI_MINIMAP } from '../../../src/shards/nalati-grasslands/look/minimap.ts';
import { SIGNAL_DUNES_MINIMAP } from '../../../src/shards/sunscar-dunes/look/minimap.ts';
import { SKY_REACH_MINIMAP } from '../../../src/shards/far-reach/look/minimap.ts';
const palettes = new Map([['nalati-grasslands', NALATI_MINIMAP], ['sunscar-dunes', SIGNAL_DUNES_MINIMAP], ['far-reach', SKY_REACH_MINIMAP]]);
const linear = c => c <= .04045 ? c / 12.92 : ((c+.055)/1.055)**2.4;
for (const developer of [false, true]) {
const assembly = new GridAssembly({ developer, devserver: false });
const make = (height, count = 257) => ({ heights: Array.from({length:count},()=>height), colours:Array.from({length:count},()=>[.25,.25,.25]), roadHeight:0 });
const cells=assembly.cells.map(cell=> {
 if(cell.slug==='_template'||cell.slug==='template') return {...cell,edges:source.edge};
 const bytes=readFileSync(`public/assets/baked/${cell.slug}/terrain.bin`);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), resolution=view.getUint32(8,true);
 const heights=Float32Array.from({length:resolution**2},(_,i)=>view.getFloat32(24+i*4,true));
 const at=(i,j)=>heights[Math.max(0,Math.min(resolution-1,j))*resolution+Math.max(0,Math.min(resolution-1,i))];
 const colourAt=index=> { const palette=palettes.get(cell.slug)?.ground; if(!palette) return [.25,.25,.25]; const i=index%resolution,j=Math.floor(index/resolution),step=500/(resolution-1),rgb=[0,0,0]; const slope=Math.min(1,Math.hypot(at(i+1,j)-at(i-1,j),at(i,j+1)-at(i,j-1))/(2*step)/2); palette(-250+i*step,-250+j*step,heights[index],slope,0,rgb); const scale=Math.max(...rgb)>1?255:1; return rgb.map(c=>Math.max(0,Math.min(1,linear(c/scale)))); };
 return {...cell,edges:nativeEdgeProfiles({resolution,heights,colourAt})};
});
try {
 const platform=generatePlatform(cells,assembly.emptyNeighbour.edge);
 const kinds={}; for(const strip of platform) for(const f of strip.features) kinds[f.kind]=(kinds[f.kind]??0)+f.indexCount/3;
 console.log(JSON.stringify({developer, realBakeHeightsAndPaletteColours:true,triangles:platform.reduce((sum,p)=>sum+p.mesh.indices.length/3,0),kinds}));
} catch(error) { console.log(String(error)); }

}
