// Diagnostic: can bounded WebCodecs AAC output reproduce the current whole-file WebAudio decoder?
// No game switch, live output or native saving claim. Wrap with browser-lane.sh.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { webkit, devices } from 'playwright';
const [out,genre='piano']=process.argv.slice(2);
if(!out||!['piano','folk','orchestral'].includes(genre))throw new Error('Pass OUT_JSON [piano|folk|orchestral]');
const spec=JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`,'utf8')).slots.title;
const file=`public/assets/music/${genre}/${spec.full}`,encoded=readFileSync(file);
const packets=JSON.parse(execFileSync('ffprobe',['-v','error','-show_packets','-show_entries','packet=pts,duration,size,pos,side_data_list','-of','json',file],{encoding:'utf8'})).packets;
const server=createServer((req,res)=>{if(req.url==='/track'){res.end(encoded);}else res.end('<!doctype html><title>Bounded AAC proof</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address||typeof address==='string')throw new Error('No origin');
const report={protocol:'Mac WebKit phone-tier, native AAC AudioDecoder versus current OfflineAudioContext.decodeAudioData. Whole reference exists only in this diagnostic; candidate output is consumed/closed per callback with at most8 compressed packets queued.',genre,spec,sourceSha256:createHash('sha256').update(encoded).digest('hex'),errors:[]};
let browser;
try{
 browser=await webkit.launch({headless:true});const ctx=await browser.newContext({...devices['iPhone 16 Pro']});const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${address.port}`);
 report.result=await page.evaluate(async packets=>{
  if(typeof AudioDecoder==='undefined')throw new Error('AudioDecoder unavailable');
  const bytes=await(await fetch('/track')).arrayBuffer();const reference=await new OfflineAudioContext(2,1,48000).decodeAudioData(bytes.slice(0));
  const config={codec:'mp4a.40.2',sampleRate:48000,numberOfChannels:2,description:new Uint8Array([0x11,0x90,0x56,0xe5,0])};
  const support=await AudioDecoder.isConfigSupported(config);if(!support.supported)throw new Error('Native AAC unsupported');
  const skipped=packets[0].side_data_list?.find(v=>v.side_data_type==='Skip Samples')?.skip_samples??0;
  let offset=-skipped,maxAbs=0,sum=0,count=0,outputFrames=0,maxOutputFrames=0,maxQueued=0,failure;
  const decoder=new AudioDecoder({error:e=>{failure=String(e);},output:data=>{
   try{
    maxOutputFrames=Math.max(maxOutputFrames,data.numberOfFrames);outputFrames+=data.numberOfFrames;
    for(let ch=0;ch<reference.numberOfChannels;ch++){
     const values=new Float32Array(data.numberOfFrames);data.copyTo(values,{planeIndex:ch,format:'f32-planar'});const original=reference.getChannelData(ch);
     for(let i=0;i<values.length;i++){const at=offset+i;if(at<0||at>=original.length)continue;const d=values[i]-original[at];maxAbs=Math.max(maxAbs,Math.abs(d));sum+=d*d;count++;}
    }
    offset+=data.numberOfFrames;
   }finally{data.close();}
  }});
  try{
   decoder.configure(config);
   for(const p of packets){
    while(decoder.decodeQueueSize>=8&&!failure)await new Promise(resolve=>setTimeout(resolve,0));
    if(failure)throw new Error(failure);
    decoder.decode(new EncodedAudioChunk({type:'key',timestamp:Math.round(p.pts/48000*1e6),data:new Uint8Array(bytes,Number(p.pos),Number(p.size))}));maxQueued=Math.max(maxQueued,decoder.decodeQueueSize);
   }
   await decoder.flush();if(failure)throw new Error(failure);
  }finally{decoder.close();}
  return{referenceFrames:reference.length,channels:reference.numberOfChannels,sampleRate:reference.sampleRate,skippedPrimingFrames:skipped,outputFrames,comparedSamples:count,maxOutputFrames,maxQueued,maxAbs,rms:Math.sqrt(sum/count),exact:maxAbs===0};
 },packets);
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));report.closed=true;writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
