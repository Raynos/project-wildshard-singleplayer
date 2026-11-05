// oxlint-disable-next-line import/no-nodejs-modules -- Exercise authoring image tools only in owned fixture folders.
import {mkdirSync,mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve explicit owned test artifacts.
import {resolve} from 'node:path';
import sharp from 'sharp';
import {beforeAll,afterAll,expect,test} from 'vitest';
import {plotAudioRows,lifeCheck,lifeSummary,captureLifeClip,makeComparisonBoard,plotTilingReport,type PlotCamera} from '../scripts/open-plots/ob2.mjs';
import {parseAudioData} from '@wildshard/format/audio';
import {plotAudioRequest} from '../scripts/open-plots/audio-template.mjs';

let folder='';
const pin='1'.repeat(40);
const camera:PlotCamera={eye:[0,2,10],look:[0,2,0],fov:62,viewport:[402,874]};
const sources=[{id:'fireflies',region:{left:10,top:100,width:20,height:20}},{id:'lanterns',region:{left:200,top:200,width:20,height:20}}];
beforeAll(async()=>{
  mkdirSync('tmp',{recursive:true});folder=resolve(mkdtempSync('tmp/ob2-tools-'));
  for(let i=0;i<11;i++){
    const bytes=Buffer.alloc(402*874*3,20);
    for(const [index,source]of sources.entries())for(let y=source.region.top;y<source.region.top+20;y++)for(let x=source.region.left;x<source.region.left+20;x++)bytes[(y*402+x)*3+index]=20+i;
    await sharp(bytes,{raw:{width:402,height:874,channels:3}}).png().toFile(resolve(folder,`frame-${i}.png`));
  }
});
afterAll(()=>{if(folder)rmSync(folder,{recursive:true});});
const life=()=>({pin,device:'iPhone 16 Pro',view:'road-entry',sources:structuredClone(sources),frames:Array.from({length:11},(_,i)=>({file:resolve(folder,`frame-${i}.png`),atMs:i*500,camera:structuredClone(camera)}))});
const audio=()=>({idea:'lantern-bayou',spots:Array.from({length:4},(_,i)=>({id:`spot-${i+1}`,at:null}))});

test('all five template audio requests use planned spots and remain unplaced',async()=>{
  for(const idea of ['frostline-peaks','lantern-bayou','ember-forge','mosslight-ruins','coral-drift']){
    const request=plotAudioRequest(idea),rows=await plotAudioRows(request);
    expect(request.spots).toHaveLength(4);expect(request.spots.every(row=>row.at===null)).toBe(true);
    expect(rows.assets).toHaveLength(6);expect(rows.activation).toBe('inert-authoring-template');
  }
  expect(()=>plotAudioRequest('../escape')).toThrow('No planned');
});

test('audio template emits silent native rows and explicit unfulfilled per-plot asset/position requests',async()=>{
  const base=readFileSync('src/shards/_template/data/audio.json');
  const result=await plotAudioRows(audio());
  expect(parseAudioData(result.audio)).toMatchObject({cues:[],routing:[],ambience:null,score:'silent'});
  expect(result.manifest.audio).toEqual({ambience:'none',score:'none'});
  expect(result.assets.map(row=>row.file)).toEqual(['public/assets/music/lantern-bayou/score.m4a','public/assets/sfx/lantern-bayou/ambience.m4a',...Array.from({length:4},(_,i)=>`public/assets/sfx/lantern-bayou/spot-${i+1}.m4a`)]);
  expect(result.pending.filter(row=>row.startsWith('position '))).toHaveLength(4);
  expect(result.activation).toBe('inert-authoring-template');expect(result.pending).toContain('OB7: verified loop metadata, retained credits and native catalogue binding before activation');
  expect(readFileSync('src/shards/_template/data/audio.json')).toEqual(base);
});

test('audio refuses a short/duplicate spot catalogue, escaping slug and out-of-cell position',async()=>{
  const source=audio();await expect(plotAudioRows({...source,spots:source.spots.slice(0,3)})).rejects.toThrow();
  await expect(plotAudioRows({...source,spots:source.spots.map(()=>source.spots[0])})).rejects.toThrow();
  await expect(plotAudioRows({...source,idea:'../other'})).rejects.toThrow();
  await expect(plotAudioRows({...source,spots:source.spots.map(row=>({id:row.id,at:[251,0,0]}))})).rejects.toThrow();
});

test('life measures all ten 500ms intervals of two separately named regions exactly',async()=>{
  const report=await lifeCheck(life());
  expect(lifeSummary(report)).toContain('PASS bar-7 pixels: 2');
  expect(lifeSummary(report)).toContain('0-500ms=400px');
  expect(report.passesPixelCheck).toBe(true);expect(report.observedMotionSources).toBe(2);
  for(const source of report.sources){expect(source.intervals).toHaveLength(10);for(const row of source.intervals)expect(row).toMatchObject({changedPixels:400,maxChannelDelta:1});}
  expect(report.frames).toHaveLength(11);expect(report.frames[10]?.atMs).toBe(5000);
});

test('global changes outside the declared regions and a static clip do not pass life',async()=>{
  const one=life();one.sources[1]={id:'still-wall',region:{left:250,top:400,width:20,height:20}};
  expect((await lifeCheck(one)).observedMotionSources).toBe(1);expect((await lifeCheck(one)).passesPixelCheck).toBe(false);
  const fixed=life();for(const frame of fixed.frames)frame.file=resolve(folder,'frame-0.png');
  const report=await lifeCheck(fixed);expect(report.observedMotionSources).toBe(0);expect(report.passesPixelCheck).toBe(false);
  expect(lifeSummary(report)).toContain('FAIL bar-7 pixels: 0');
});

test('life refuses overlap, missing endpoint, camera drift, wrong cadence and lossy images',async()=>{
  const overlap=life();overlap.sources[1]={id:'same-source-again',region:{...sources[0]?.region,left:10,top:100,width:20,height:20}};await expect(lifeCheck(overlap)).rejects.toThrow('overlap');
  const short=life();short.frames.pop();await expect(lifeCheck(short)).rejects.toThrow();
  const drift=life();const last=drift.frames[10];if(last===undefined)throw new Error('Missing last sample');last.camera.eye[0]=1;await expect(lifeCheck(drift)).rejects.toThrow('fixed');
  const cadence=life();const first=cadence.frames[0];if(first===undefined)throw new Error('Missing first sample');first.atMs=100;await expect(lifeCheck(cadence)).rejects.toThrow();
  const lossy=life();const row=lossy.frames[0];if(row===undefined)throw new Error('Missing first sample');row.file=resolve(folder,'not-lossless.jpg');await expect(lifeCheck(lossy)).rejects.toThrow('PNG');
  const renamed=resolve(folder,'renamed.png');await sharp(resolve(folder,'frame-0.png')).jpeg().toFile(renamed);
  const disguised=life();const frame=disguised.frames[0];if(frame===undefined)throw new Error('Missing sample');frame.file=renamed;await expect(lifeCheck(disguised)).rejects.toThrow('actually be PNG');
});

test('capture helper keeps an actual five-second schedule and static pixel failure without launching a browser',async()=>{
  let calls=0;const png=readFileSync(resolve(folder,'frame-0.png'));
  const page={screenshot:()=>{calls++;return Promise.resolve(png);}};
  const input={pin,device:'iPhone 16 Pro',view:'road-entry',sources};
  const destination=resolve(folder,'synthetic-static-clip');
  const reading=await captureLifeClip(page,()=>Promise.resolve(structuredClone(camera)),input,destination);
  expect(calls).toBe(11);expect(reading.frames[10]?.atMs).toBeGreaterThanOrEqual(5000);expect(reading.frames[10]?.targetMs).toBe(5000);expect(reading.passesPixelCheck).toBe(false);
  expect(readFileSync(resolve(destination,'capture.json'),'utf8')).toContain('frame-10.png');
  await expect(captureLifeClip(page,()=>Promise.resolve(structuredClone(camera)),input,destination)).rejects.toThrow();
},10_000);

function board(){return {idea:'lantern-bayou',title:'OB2 TEST FIXTURE — synthetic inputs',views:['above-neighbour','road-entry','top-down','plaza'].map((id,i)=>{
  const pose={...structuredClone(camera),eye:[i,2,10]};return {id,mockup:{file:resolve(folder,`frame-${i}.png`),crop:{left:0,top:0,width:402,height:874}},now:{file:resolve(folder,`frame-${i}.png`),pin,camera:structuredClone(pose)},nightMarket:{file:resolve(folder,`frame-${i}.png`),pin:'2'.repeat(40),camera:structuredClone(pose)}};
})};}
test('board renders a labelled iPhone-portrait four-by-three JPEG under 500KB, with all source hashes',async()=>{
  const input=board(),before=input.views.map(row=>readFileSync(row.now.file));
  const result=await makeComparisonBoard(input),metadata=await sharp(result.jpeg).metadata();
  expect([metadata.width,metadata.height]).toEqual([1206,2622]);expect(result.jpeg.length).toBeLessThanOrEqual(500_000);expect(metadata.format).toBe('jpeg');expect(result.reading.provenance).toHaveLength(12);
  expect(result.reading.provenance.every(row=>row.sha256.length===64)).toBe(true);
  expect(input.views.map(row=>readFileSync(row.now.file))).toEqual(before);
  mkdirSync('tmp/sp-x1-ob2',{recursive:true});writeFileSync('tmp/sp-x1-ob2/board-fixture.jpg',result.jpeg);
});
test('board refuses camera mismatch and out-of-image mockup crops',async()=>{
  const mismatch=board(),first=mismatch.views[0];if(first===undefined)throw new Error('Missing view');first.nightMarket.camera.fov=60;
  await expect(makeComparisonBoard(mismatch)).rejects.toThrow('same plot-local');
  const cropped=board(),row=cropped.views[0];if(row===undefined)throw new Error('Missing view');row.mockup.crop.width=403;
  await expect(makeComparisonBoard(cropped)).rejects.toThrow('bounds');
});
test('tiling refuses an escaping plot identity without generating any product',async()=>{
  await expect(plotTilingReport('../pine-hollow')).rejects.toThrow();
});
