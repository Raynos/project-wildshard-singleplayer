import {expect,it} from 'vitest';
import {M2_GRID_SHARDS,M2_GRID_PLOTS,M2_GRID_PLOT_CELLS,MILESTONE_SHARDS,m3Progress,planProgress} from '../scripts/shard-milestones.mjs';
import {nextRuler,readRuler} from '../scripts/admin-data/ruler.mjs';

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

it('preserves complete M2 and frame-floor coverage in the admin ruler JSON',()=>{
 const input=rows(),native=input['pastel-plain'];
 if(native===undefined)throw new Error('Missing native fixture');
 input['pastel-plain']={...native,gridReady:{...native.gridReady,frameFloor:{verdict:'fail',evidence:'Measured slow frame'}}};
 const raw={...input,_summary:{progress:planProgress(input),netLines:[]}};
 const ruler=readRuler(nextRuler(raw,null,{revision:'b'.repeat(40),committedAt:'2026-10-21T12:00:00Z',now:'2026-10-21T12:01:00Z'}));
 expect(ruler.m2).toMatchObject({ready:10,fail:0,unknown:0,total:10,shards:M2_GRID_SHARDS,plots:15,
  plotReadiness:{ready:0,fail:0,unknown:15,total:15}});
 expect(ruler.frameFloor).toEqual({ready:9,fail:1,unknown:0,total:10});
 expect(ruler.shards).toHaveLength(6);
 expect(()=>readRuler({...ruler,m2:{...ruler.m2,total:25}})).toThrow('M2 coverage');
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
 const ruler=nextRuler({...input,_summary:{progress,netLines:[]}},null,{revision:'d'.repeat(40),committedAt:'2026-10-21T12:00:00Z',now:'2026-10-21T12:01:00Z'});
 expect(ruler.m2).toMatchObject({plotReadiness:{ready:13,fail:2,unknown:0,total:15},
  readiness:{'open-plot-night-market':{verdict:'fail',criteria:{memory:{evidence:'Latched measured source'}}}}});
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
 const progress=planProgress(input),retired={...progress,m3:{...progress.m3,mustGo:80000,fraction:1.1},plan:{lower:.84,upper:.84}};
 const ruler=nextRuler({...input,_summary:{progress:retired,netLines:[]}},null,
  {revision:'e'.repeat(40),committedAt:'2026-10-21T12:00:00Z',now:'2026-10-21T12:01:00Z'});
 expect(progress.m3).toMatchObject({cut:89880,mustGo:98854});
 expect(Number(((progress.m3.fraction??0)*100).toFixed(1))).toBe(90.9);
 expect(Number(((progress.plan?.lower??0)*100).toFixed(1))).toBe(78.6);
 expect(ruler.m3).toMatchObject({cut:89880,mustGo:98854,fraction:progress.m3.fraction});
 expect(ruler.plan).toEqual(progress.plan);
 expect(ruler.shards.every(shard=>shard.goal===0)).toBe(true);expect(ruler.wave.goal).toBe(0);
 // A wave that met the retired 20% target must reopen until its custom count is zero.
 const previous=structuredClone(ruler);
 for(const wave of previous.waves)wave.endedAt='2026-10-20T12:00:00Z';
 const next=nextRuler({...input,_summary:{progress,netLines:[]}},previous,
  {revision:'f'.repeat(40),committedAt:'2026-10-21T12:02:00Z',now:'2026-10-21T12:03:00Z'});
 expect(next.wave.id).toBe('W2');expect(next.waves.find(wave=>wave.id==='W2')?.endedAt).toBeNull();
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
