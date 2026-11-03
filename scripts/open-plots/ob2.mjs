// @ts-check
// OB2 authoring/report tools. No producer, browser, audio player or game clock.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,statSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import sharp from 'sharp';
import * as v from 'valibot';
import {plotAudioRequest} from './audio-template.mjs';

const finite=v.pipe(v.number(),v.finite()),natural=v.pipe(finite,v.integer(),v.minValue(0));
const positive=v.pipe(natural,v.minValue(1)),text=v.pipe(v.string(),v.minLength(1),v.maxLength(160));
const filePath=v.pipe(v.string(),v.minLength(1),v.maxLength(4096),v.check(value=>!value.includes('\0'),'File path cannot contain NUL'));
const idea=v.pipe(v.string(),v.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u),v.maxLength(64));
const point=v.tuple([finite,finite,finite]);
const camera=v.pipe(v.strictObject({eye:point,look:point,fov:v.pipe(finite,v.minValue(1),v.maxValue(179)),viewport:v.tuple([positive,positive])}),
  v.check(row=>row.eye.some((word,i)=>word!==row.look[i]),'Camera needs a direction'));
const rect=v.strictObject({left:natural,top:natural,width:positive,height:positive});
const pin=v.pipe(v.string(),v.regex(/^[a-f0-9]{40}$/u));
const views=/** @type {const} */ (['above-neighbour','road-entry','top-down','plaza']);
const audioInput=v.strictObject({idea,spots:v.pipe(v.array(v.strictObject({id:idea,at:v.nullable(v.pipe(point,v.check(row=>row.every(word=>Math.abs(word)<=250),'Spot belongs to the 500 m plot')))})),v.minLength(4),v.maxLength(32),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'Distinct positional spot ids'))});
const sourceRows=v.pipe(v.array(v.strictObject({id:idea,region:rect})),v.minLength(2),v.maxLength(16),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'Distinct named motion sources'));
const lifeClip=v.strictObject({pin,view:v.literal('road-entry'),device:v.literal('iPhone 16 Pro'),sources:sourceRows});
const lifeInput=v.strictObject({...lifeClip.entries,
  frames:v.pipe(v.array(v.strictObject({file:filePath,atMs:v.pipe(finite,v.minValue(0)),camera})),v.length(11),
    v.check(rows=>rows.every((row,i)=>i===0?row.atMs===0:row.atMs>=i*500&&row.atMs<=i*500+100),'0..5000 ms samples with at most 100 ms capture lateness'))});
const capture=v.strictObject({file:filePath,pin,camera});
const boardInput=v.strictObject({idea,title:v.pipe(text,v.maxLength(80)),views:v.pipe(v.array(v.strictObject({id:v.picklist(views),
  mockup:v.strictObject({file:filePath,crop:rect}),now:capture,nightMarket:capture})),v.length(4),
  v.check(rows=>rows.every((row,i)=>row.id===views[i]),'Four ordered hero cameras'))});
/** @param {Uint8Array} bytes */
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
/** @param {string} file */
function image(file){
  if(!['.jpg','.jpeg','.png','.webp'].includes(extname(file).toLowerCase()))throw new Error('Expected a raster image');
  if(statSync(file).size>32_000_000)throw new Error('Image exceeds 32 MB input bound');
  return sharp(file,{limitInputPixels:16_777_216});
}
/** @param {{left:number,top:number,width:number,height:number}} box @param {number} width @param {number} height */
function inside(box,width,height){if(box.left+box.width>width||box.top+box.height>height)throw new Error('Region exceeds image bounds');}
/** @param {string} value */
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
/** @param {readonly {id:string,region:import('./ob2.mjs').PixelRegion}[]} sources @param {[number,number]} viewport */
function lifeRegions(sources,viewport){
  const [width,height]=viewport;
  if(width!==402||height!==874)throw new Error('Life clip requires iPhone portrait CSS frames, 402x874');
  for(const source of sources)inside(source.region,width,height);
  for(let i=0;i<sources.length;i++)for(let j=0;j<i;j++){
    const a=sources[i]?.region,b=sources[j]?.region;
    if(a!==undefined&&b!==undefined&&a.left<b.left+b.width&&b.left<a.left+a.width&&a.top<b.top+b.height&&b.top<a.top+a.height)throw new Error('Motion source regions overlap');
  }
}

/** Emit inert manifest/native rows and explicit asset/position requests. Audio
 * assets, loop metadata and credits belong to OB7; missing work never plays.
 * @param {unknown} input @param {string} [root] */
export async function plotAudioRows(input,root=process.cwd()){
  const data=v.parse(audioInput,input);
  if(data.spots.some(row=>row.id==='score'||row.id==='ambience'))throw new Error('Spot ids must not shadow score or ambience');
  const {parseAudioData}=await import('@wildshard/format/audio');
  const template=parseAudioData(JSON.parse(readFileSync(resolve(root,'src/shards/_template/data/audio.json'),'utf8')));
  const music=`public/assets/music/${data.idea}/`,sfx=`public/assets/sfx/${data.idea}/`;
  const assets=[{id:'score',file:`${music}score.m4a`,kind:'score',generator:'MiniMax Music 3'},
    {id:'ambience',file:`${sfx}ambience.m4a`,kind:'bed',generator:'MOSS-SoundEffect v2 + Stable Audio 3 Medium: select better take'},
    ...data.spots.map(row=>({id:row.id,file:`${sfx}${row.id}.m4a`,kind:'spot',at:row.at,generator:'MOSS-SoundEffect v2 + Stable Audio 3 Medium: select better take'}))];
  return {protocol:'open-plot-audio-template/1',idea:data.idea,activation:'inert-authoring-template',
    manifest:{audio:{ambience:'none',score:'none'}},
    audio:parseAudioData({...template,cues:[],routing:[],ambience:null,score:'silent'}),
    catalogues:{music:`${music}music.json`,sfx:`${sfx}sfx.json`},assets,
    pending:[...assets.filter(row=>!existsSync(resolve(root,row.file))).map(row=>`missing ${row.file}`),
      ...data.spots.filter(row=>row.at===null).map(row=>`position ${row.id}`),
      'OB7: verified loop metadata, retained credits and native catalogue binding before activation']};
}

/** Sample one already-owned, live page; no browser, camera or gameplay mutation.
 * The caller keeps its browser-lane lease, version/readiness and real-camera
 * witness. Absolute scheduling prevents screenshot time accumulating each leg.
 * @param {Pick<import('playwright').Page,'screenshot'>} page
 * @param {()=>Promise<import('./ob2.mjs').PlotCamera>} readCamera
 * @param {unknown} input @param {string} folder */
export async function captureLifeClip(page,readCamera,input,folder){
  const data=v.parse(lifeClip,input),destination=resolve(folder);
  mkdirSync(dirname(destination),{recursive:true});mkdirSync(destination);
  /** @type {{file:string,atMs:number,camera:import('./ob2.mjs').PlotCamera}[]} */ const frames=[];
  let start=0;
  try{
    for(let i=0;i<=10;i++){
      if(i>0){const remaining=start+i*500-performance.now();if(remaining>0)await new Promise(_resolve=>{setTimeout(_resolve,Math.ceil(remaining)+1);});}
      const pose=v.parse(camera,await readCamera());
      if(i===0){lifeRegions(data.sources,pose.viewport);start=performance.now();}
      else assert.deepEqual(pose,frames[0]?.camera,'Life camera/framing must stay fixed');
      const atMs=i===0?0:performance.now()-start;
      if(atMs>i*500+100)throw new Error('Life screenshot sampling missed its 100 ms deadline');
      const file=resolve(destination,`frame-${i}.png`);
      const bytes=await page.screenshot({type:'png',scale:'css',animations:'allow'});
      writeFileSync(file,bytes);frames.push({file,atMs,camera:pose});
    }
    const captureInput={...data,frames};writeFileSync(resolve(destination,'capture.json'),`${JSON.stringify(captureInput,null,2)}\n`);
    const reading=await lifeCheck(captureInput);writeFileSync(resolve(destination,'reading.json'),`${JSON.stringify(reading,null,2)}\n`);return reading;
  }catch(error){writeFileSync(resolve(destination,'capture-refused.json'),`${JSON.stringify({...data,frames,error:String(error)},null,2)}\n`);throw error;}
}

/** Pixel evidence for declared, disjoint sources in one stationary road clip.
 * Source identity is authored by the plot owner, never inferred from flicker.
 * PNGs include both 0 and 5000 ms targets; actual sampling timestamps stay raw.
 * @param {unknown} input */
export async function lifeCheck(input){
  const data=v.parse(lifeInput,input),first=data.frames[0];
  if(first===undefined)throw new Error('Missing first frame');
  const [width,height]=first.camera.viewport;
  lifeRegions(data.sources,first.camera.viewport);
  /** @type {{atMs:number,file:string,sha256:string,pixels:Buffer}[]} */ const frames=[];
  for(const frame of data.frames){
    assert.deepEqual(frame.camera,first.camera,'Life camera/framing must stay fixed');
    if(extname(frame.file).toLowerCase()!=='.png')throw new Error('Life pixel checks require lossless PNG samples');
    const pipeline=image(frame.file),metadata=await pipeline.metadata();
    if(metadata.format!=='png')throw new Error('Life samples must actually be PNG, not renamed lossy images');
    const bytes=readFileSync(frame.file),{data:pixels,info}=await pipeline.removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
    if(info.width!==width||info.height!==height||info.channels!==3)throw new Error('Life frame dimensions differ');
    frames.push({atMs:frame.atMs,file:frame.file,sha256:hash(bytes),pixels});
  }
  const sources=data.sources.map(source=>{
    const intervals=[];
    for(let i=1;i<frames.length;i++){
      const before=frames[i-1],after=frames[i];if(before===undefined||after===undefined)throw new Error('Missing clip sample');
      let changedPixels=0,maxChannelDelta=0;
      for(let y=source.region.top;y<source.region.top+source.region.height;y++)for(let x=source.region.left;x<source.region.left+source.region.width;x++){
        let changed=false;
        for(let c=0;c<3;c++){const delta=Math.abs(after.pixels[(y*width+x)*3+c]-before.pixels[(y*width+x)*3+c]);maxChannelDelta=Math.max(maxChannelDelta,delta);changed ||= delta!==0;}
        if(changed)changedPixels++;
      }
      intervals.push({fromMs:before.atMs,toMs:after.atMs,changedPixels,maxChannelDelta});
    }
    return {...source,pixels:source.region.width*source.region.height,intervals,moving:intervals.some(row=>row.changedPixels>0)};
  });
  const observedMotionSources=sources.filter(row=>row.moving).length;
  return {protocol:'open-plot-life/1',pin:data.pin,view:data.view,device:data.device,
    scope:'Exact RGB change in owner-declared disjoint source regions; source identity and visual bar remain the owner review',
    frames:frames.map((row,i)=>({atMs:row.atMs,file:row.file,sha256:row.sha256,targetMs:i*500})),sources,observedMotionSources,passesPixelCheck:observedMotionSources>=2};
}

/** Human-readable interval counts; a negative pixel result is explicit.
 * @param {import('./ob2.mjs').LifeReading} reading */
export function lifeSummary(reading){
  return [`${reading.passesPixelCheck?'PASS':'FAIL'} bar-7 pixels: ${reading.observedMotionSources} changing declared regions`,
    ...reading.sources.map(source=>`${source.id}: ${source.intervals.map(row=>`${Math.round(row.fromMs)}-${Math.round(row.toMs)}ms=${row.changedPixels}px`).join(' | ')}`),
    'Pixel evidence only; the plot owner verifies two distinct visible motion sources.'].join('\n');
}

/** Four matching-camera rows, three labelled columns; actual captures are
 * contained without cropping or stretching. Only MOCKUP has an explicit crop.
 * @param {unknown} input */
export async function makeComparisonBoard(input){
  const data=v.parse(boardInput,input),width=1206,height=2622,header=150,rowHeight=618,column=402;
  if(new Set(data.views.map(row=>JSON.stringify(row.now.camera))).size!==4)throw new Error('Four distinct hero cameras required');
  /** @type {import('sharp').OverlayOptions[]} */ const layers=[];
  const provenance=[];
  for(const [i,row]of data.views.entries()){
    assert.deepEqual(row.now.camera,row.nightMarket.camera,'NOW/Night Market must use the same plot-local camera and framing');
    const cameraRow=row.now.camera;
    if(cameraRow.viewport[0]>=cameraRow.viewport[1])throw new Error('Capture viewport must be portrait');
    for(const [j,entry]of [row.mockup,row.now,row.nightMarket].entries()){
      const metadata=await image(entry.file).metadata(),original=readFileSync(entry.file);
      if(metadata.width===undefined||metadata.height===undefined)throw new Error('Image dimensions unavailable');
      let pipeline=image(entry.file);
      if('crop'in entry){inside(entry.crop,metadata.width,metadata.height);pipeline=pipeline.extract(entry.crop);}
      else if(metadata.width!==cameraRow.viewport[0]||metadata.height!==cameraRow.viewport[1])throw new Error('Captured image differs from declared viewport');
      const bytes=await pipeline.resize(column,570,{fit:'contain',background:'#09131c'}).png().toBuffer();
      layers.push({input:bytes,left:j*column,top:header+i*rowHeight+40});
      provenance.push({view:row.id,column:j,file:entry.file,sha256:hash(original),...('crop'in entry?{crop:entry.crop}:{pin:entry.pin,camera:entry.camera})});
    }
  }
  const svg=`<svg width="${width}" height="${height}"><g fill="white" font-family="sans-serif"><text x="22" y="38" font-size="24">${escape(data.title)}</text>${['MOCKUP','PLOT NOW','NIGHT MARKET NOW'].map((label,i)=>`<text x="${i*column+14}" y="105" font-size="21">${escape(label)}</text>`).join('')}${data.views.map((row,i)=>`<text x="16" y="${header+i*rowHeight+29}" font-size="22">${i+1} · ${escape(row.id)}</text>`).join('')}</g></svg>`;
  layers.push({input:Buffer.from(svg),left:0,top:0});
  const composed=await sharp({create:{width,height,channels:3,background:'#09131c'}}).composite(layers).png().toBuffer();
  for(const quality of [84,76,68,60,52,44,36,28]){
    const jpeg=await sharp(composed).jpeg({quality,mozjpeg:true}).toBuffer();
    if(jpeg.length<=500_000)return {jpeg,reading:{protocol:'open-plot-comparison/1',idea:data.idea,width,height,quality,bytes:jpeg.length,provenance}};
  }
  throw new Error('Board exceeds unchanged 500 KB cap');
}

/** Strict ordinary product selection plus the existing verified NT7 report.
 * No generation, cache repin or live-memory/capture claim.
 * @param {string} value @param {string} [root] */
export async function plotTilingReport(value,root=process.cwd()){
  const slug=`open-plot-${v.parse(idea,value)}`;
  const [{readBuiltShardfile},{readTilingReport,tilingMarkdown}]=await Promise.all([import('../build-shardfiles.mjs'),import('../tile-bake-report.mjs')]);
  const report=readTilingReport(root,slug,readBuiltShardfile(root,slug));
  if(report.tiles.length===0)throw new Error('No verified tiled plot rows');
  return {report,markdown:tilingMarkdown(report)};
}

if(process.argv[1]!==undefined&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const command=process.argv[2],{values}=parseArgs({args:process.argv.slice(3),options:{input:{type:'string'},out:{type:'string'},plot:{type:'string'}}});
  if(values.out===undefined)throw new Error('Explicit --out required');
  const out=resolve(values.out);
  if(values.input!==undefined&&out===resolve(values.input))throw new Error('Output cannot overwrite input');
  /** @type {unknown} */ const input=values.input===undefined?undefined:JSON.parse(readFileSync(values.input,'utf8'));
  /** @param {string} file @param {unknown} value */
  const save=(file,value)=>{mkdirSync(dirname(file),{recursive:true});writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);};
  if(command==='audio'){
    if(out===resolve('src/shards/_template/data/audio.json'))throw new Error('Do not overwrite the native audio template');
    if(values.input!==undefined&&values.plot!==undefined)throw new Error('Use audio --input or --plot, not both');
    save(out,await plotAudioRows(values.plot===undefined?input:plotAudioRequest(values.plot)));
  }
  else if(command==='life'){const report=await lifeCheck(input);save(out,report);console.info(lifeSummary(report));if(!report.passesPixelCheck)process.exitCode=2;}
  else if(command==='board'){
    const result=await makeComparisonBoard(input);if(extname(out).toLowerCase()!=='.jpg')throw new Error('Board output must be JPEG .jpg');
    if(values.input!==undefined&&`${out}.json`===resolve(values.input))throw new Error('Sidecar cannot overwrite input');
    const sources=result.reading.provenance.map(row=>resolve(row.file));if(sources.includes(out))throw new Error('Board cannot overwrite an input image');
    mkdirSync(dirname(out),{recursive:true});writeFileSync(out,result.jpeg);save(`${out}.json`,result.reading);
  }else if(command==='tiling'){
    if(values.plot===undefined)throw new Error('Explicit --plot required');const result=await plotTilingReport(values.plot);
    save(`${out}.json`,result.report);mkdirSync(dirname(out),{recursive:true});writeFileSync(`${out}.md`,`${result.markdown}\n`);
  }else throw new Error('Expected audio, life, board or tiling');
}
