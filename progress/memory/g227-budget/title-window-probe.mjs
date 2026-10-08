// Offline proof of bounded native-buffer windows plus a compact native loop bridge. No production switch.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { webkit, devices } from 'playwright';
const [out,actual]=process.argv.slice(2);if(!out||(actual!==undefined&&actual!=='piano'))throw new Error('Pass OUT_JSON [piano], wrap with browser-lane.sh');
const title=actual?JSON.parse(readFileSync(`public/assets/music/${actual}/music.json`,'utf8')).slots.title:undefined;
const encoded=title?readFileSync(`public/assets/music/${actual}/${title.full}`):undefined;
const server=createServer((req,res)=>{if(req.url==='/track'&&encoded)res.end(encoded);else res.end('<!doctype html><title>Bounded loop proof</title>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No origin');
const report={protocol:'OfflineAudioContext, same Float32 PCM / original native loop versus bounded native sources with guard samples and a compact loop bridge. No media seek. No native saving claim.',cases:[],errors:[]};let browser;
try{
 browser=await webkit.launch({headless:true});const context=await browser.newContext({...devices['iPhone 16 Pro']});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(`http://127.0.0.1:${address.port}`);
 report.cases=await page.evaluate(async title=>{
  const results=[],actual=title?await new OfflineAudioContext(2,1,48000).decodeAudioData(await(await fetch('/track')).arrayBuffer()):undefined;
  for(const rate of [48000,44100,96000])for(const fractional of (title?[false]:[false,true])){
   const sourceRate=48000,seconds=title?4:10,start=.1,loopStart=title?.loopStart??(fractional?1.12345:1.25),loopEnd=title?.loopEnd??(fractional?3.23456:3.25),initial=title?loopEnd-.6:0;
   const make=context=>{
    if(actual)return actual;
    const b=context.createBuffer(2,sourceRate*4,sourceRate);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=.13*Math.sin(i*.036+c*.15)+.07*Math.cos(i*.0047+i*i*1e-8);}
    return b;
   };
   let largestWindowFrames=0,windows=0;
   const render=async bounded=>{
    const ctx=new OfflineAudioContext(2,rate*seconds,rate),buffer=make(ctx),gain=ctx.createGain();gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+.6);gain.gain.setValueAtTime(1,title?2:7);gain.gain.linearRampToValueAtTime(0,title?3.5:9);
    if(!bounded){const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;source.connect(gain);source.start(start,initial);}
    else{
     let time=0,at=initial;
     const guard=32,seam=.125;
     while(time<seconds-start){
      const toBridge=loopEnd-seam-at;
      let frames,offset,duration,bridge=false,headStart=0,tailStart=0,headFrames=0;
      if(toBridge>1e-9){duration=Math.min(.5,toBridge);const first=Math.max(0,Math.floor(at*sourceRate)-guard),last=Math.min(buffer.length,Math.ceil((at+duration)*sourceRate)+guard);frames=last-first;offset=at-first/sourceRate;headStart=first;}
      else{bridge=true;duration=2*seam;headStart=Math.floor(loopStart*sourceRate)-guard;headFrames=Math.ceil((loopStart+seam)*sourceRate)+guard-headStart;tailStart=Math.floor(at*sourceRate)-guard;frames=headFrames+Math.ceil(loopEnd*sourceRate)+guard-tailStart;offset=(headFrames+at*sourceRate-tailStart)/sourceRate;}
      largestWindowFrames=Math.max(largestWindowFrames,frames);windows++;
      const part=ctx.createBuffer(2,frames,sourceRate);
      for(let c=0;c<2;c++){const dest=part.getChannelData(c),source=buffer.getChannelData(c);if(bridge){dest.set(source.subarray(headStart,headStart+headFrames));dest.set(source.subarray(tailStart,tailStart+frames-headFrames),headFrames);}else dest.set(source.subarray(headStart,headStart+frames));}
      const source=ctx.createBufferSource();source.buffer=part;source.connect(gain);
      if(bridge){source.loop=true;source.loopStart=loopStart-headStart/sourceRate;source.loopEnd=(headFrames+loopEnd*sourceRate-tailStart)/sourceRate;}
      source.start(start+time,offset);source.stop(start+time+duration);time+=duration;at=bridge?loopStart+seam:at+duration;
     }
    }
    return ctx.startRendering();
   };
   const a=await render(false),b=await render(true);let maxAbs=0,sum=0,count=0,firstDifference;
   for(let c=0;c<2;c++)for(let i=0;i<a.length;i++){const d=a.getChannelData(c)[i]-b.getChannelData(c)[i];if(d!==0&&firstDifference===undefined)firstDifference={frame:i,seconds:i/rate,a:a.getChannelData(c)[i],b:b.getChannelData(c)[i]};maxAbs=Math.max(maxAbs,Math.abs(d));sum+=d*d;count++;}
   results.push({rate,sourceRate,loopStart,loopEnd,fractional,comparedSamples:count,largestWindowFrames,windows,maxAbs,rms:Math.sqrt(sum/count),firstDifference,exact:maxAbs===0});
  }
  return results;
 },title);
}catch(e){report.failure=String(e);process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));report.closed=true;writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
