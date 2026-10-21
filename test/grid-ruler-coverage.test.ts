import {expect,it} from 'vitest';
import {M2_GRID_SHARDS,M2_GRID_PLOTS,MILESTONE_SHARDS,m3Progress,planProgress} from '../scripts/shard-milestones.mjs';
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
 expect(progress.m3).toMatchObject({cut:480,mustGo:500,fraction:.96,shards:6});
 expect(progress.plan?.lower).toBeCloseTo(.896);
 expect(progress.plan?.upper).toBeCloseTo(.936);
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
 expect(ruler.m2).toEqual({ready:10,fail:0,unknown:0,total:10,shards:M2_GRID_SHARDS,plots:15});
 expect(ruler.frameFloor).toEqual({ready:9,fail:1,unknown:0,total:10});
 expect(ruler.shards).toHaveLength(6);
 expect(()=>readRuler({...ruler,m2:{...ruler.m2,total:25}})).toThrow('M2 coverage');
});
