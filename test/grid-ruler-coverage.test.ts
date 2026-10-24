import {expect,it} from 'vitest';
import {M2_GRID_SHARDS,M2_GRID_PLOTS,M2_GRID_PLOT_CELLS,MILESTONE_SHARDS,m3Progress,planProgress} from '../scripts/shard-milestones.mjs';

function rows():Parameters<typeof planProgress>[0] {
 const result:Parameters<typeof planProgress>[0]={};
 for(const slug of M2_GRID_SHARDS)result[slug]={
  m3:m3Progress(slug,{basis:'source',customLines:20,legacyLines:MILESTONE_SHARDS.includes(slug)?100:null}),
  gridReady:{verdict:'pass',criteria:{},frameFloor:{verdict:'pass',evidence:'Fixture reading'}},
 };
 return result;
}

it('covers all ten authored playable grid shards and counts fifteen plot cells separately',()=>{
 expect(M2_GRID_SHARDS).toEqual(['_template','blender-template','driftwood-isle','far-reach','ink-cel-valley',
  'nalati-grasslands','nine-dragon-stack','pastel-plain','pine-hollow','sunscar-dunes']);
 expect(M2_GRID_PLOTS).toBe(15);
 const input=rows(),native=input['pastel-plain'];
 if(native===undefined)throw new Error('Missing native fixture');
 input['pastel-plain']={...native,gridReady:{...native.gridReady,verdict:'fail'}};
 delete input['ink-cel-valley'];
 input['open-plots']={...native,gridReady:{...native.gridReady,verdict:'pass'}};
 input['open-plot-night-market']={...native,gridReady:{...native.gridReady,verdict:'fail'}};
 const progress=planProgress(input);
 expect(progress.m2).toMatchObject({ready:8,unknown:1,total:10,plots:15,lower:.8,upper:.9});
 expect(progress.m3).toMatchObject({cut:480,mustGo:600,fraction:.8,shards:6});
 expect(progress.plan?.lower).toBeCloseTo(.8);
 expect(progress.plan?.upper).toBeCloseTo(.84);
});

it('keeps missing native evidence unknown and retains the six legacy M3 denominators',()=>{
 const input=rows();
 for(const slug of M2_GRID_SHARDS)if(!MILESTONE_SHARDS.includes(slug))delete input[slug];
 const progress=planProgress(input);
 expect(progress.m2).toMatchObject({ready:6,unknown:4,total:10,lower:.6,upper:1});
 expect(progress.frameFloor).toEqual({ready:6,fail:0,unknown:4,total:10});
 expect(progress.m3.shards).toBe(6);
});

it('reports each plot placement separately and retains per-product criterion evidence',()=>{
 const input=rows();
 const plots:Record<string,NonNullable<Parameters<typeof planProgress>[1]>[string]>={};
 for(const cell of M2_GRID_PLOT_CELLS)plots[cell.slug]={verdict:'pass',criteria:{memory:{verdict:'pass',evidence:'Latched measured source'}}};
 const night=plots['open-plot-night-market'];if(night===undefined)throw new Error('Missing repeated plot');
 night.verdict='fail';
 const progress=planProgress(input,plots);
 expect(progress.m2.plotReadiness).toEqual({ready:13,fail:2,unknown:0,total:15});
 expect(progress.m2.ready).toBe(10);

});

it('G567 measures the recorded baseline toward zero with the original 98,854 lines',()=>{
 const input=rows();
 const baseline=[['pine-hollow',21305,1168],['driftwood-isle',17167,1333],['far-reach',6779,0],
  ['sunscar-dunes',4122,0],['nalati-grasslands',28370,4610],['nine-dragon-stack',21111,1863]] as const;
 for(const [slug,legacyLines,customLines]of baseline){
  const original=input[slug];if(original===undefined)throw new Error('Missing legacy fixture');
  input[slug]={...original,m3:m3Progress(slug,{basis:'source',legacyLines,customLines})};
 }
 for(const slug of ['_template','blender-template','far-reach','sunscar-dunes']){
  const original=input[slug];if(original===undefined)throw new Error('Missing grid fixture');
  input[slug]={...original,gridReady:{verdict:'fail',criteria:{}}};
 }
 const progress=planProgress(input);
 expect(progress.m3).toMatchObject({cut:89880,mustGo:98854});
 expect(Number(((progress.m3.fraction??0)*100).toFixed(1))).toBe(90.9);
 expect(Number(((progress.plan?.lower??0)*100).toFixed(1))).toBe(78.6);

});

it('G567 does not cap the M3 contribution to the plan',()=>{
 const input=rows();
 for(const slug of MILESTONE_SHARDS){
  const original=input[slug];if(original?.m3===null||original===undefined)throw new Error('Missing measured fixture');
  input[slug]={...original,m3:{...original.m3,cut:120,mustGo:100,fraction:1.2}};
 }
 const progress=planProgress(input);
 expect(progress.m3.fraction).toBe(1.2);expect(progress.plan?.lower).toBeCloseTo(1.12);
});
