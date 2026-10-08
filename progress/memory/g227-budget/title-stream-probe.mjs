// Diagnostic only: record the original buffer loop and a media-element custom loop into a silent worklet.
// This does not change game playback. Run with browser-lane.sh; no app build or Simulator required.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { webkit, devices } from 'playwright';
const [output, genre = 'piano'] = process.argv.slice(2);
if (!output || !['piano','folk','orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral]');
const manifest = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8'));
const spec = manifest.slots.title;
const encoded = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const worklet = `class Capture extends AudioWorkletProcessor {
  process(inputs, outputs) {
    this.port.postMessage({ frame: currentFrame, a: inputs[0]?.[0] ?? new Float32Array(128), b: inputs[1]?.[0] ?? new Float32Array(128) });
    for (const output of outputs) for (const channel of output) channel.fill(0);
    return true;
  }
} registerProcessor('capture', Capture);`;
const server = createServer((request,response) => {
  if (request.url === '/track.m4a') { response.setHeader('Content-Type','audio/mp4'); response.end(encoded); }
  else if (request.url === '/capture.js') { response.setHeader('Content-Type','application/javascript'); response.end(worklet); }
  else { response.setHeader('Content-Type','text/html'); response.end('<!doctype html><button>Record silent comparison</button>'); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Missing probe address');
let browser;
const report = { protocol: 'Mac WebKit phone-tier media-source capture, silent worklet output. Diagnostic only; no production change and no native saving credit.', genre, spec, sourceSha256: createHash('sha256').update(encoded).digest('hex'), errors: [] };
try {
  browser = await webkit.launch({headless:true});
  const context = await browser.newContext({...devices['iPhone 16 Pro']});
  const page = await context.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.evaluate(({loopStart,loopEnd})=> {
    document.querySelector('button').onclick=()=> {
      window.recording=(async()=> {
        const ctx=new AudioContext({sampleRate:48000}); await ctx.resume();
        const chunks=[],seeks=[],clock=[];
        const encoded=await (await fetch('/track.m4a')).arrayBuffer();
        const original=await new OfflineAudioContext(2,1,48000).decodeAudioData(encoded.slice(0));
        await ctx.audioWorklet.addModule('/capture.js');
        const capture=new AudioWorkletNode(ctx,'capture',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]});
        capture.port.onmessage=event=>chunks.push(event.data);
        capture.connect(ctx.destination); // the processor always outputs zero: no audible device output
        const element=new Audio(); element.preload='auto'; element.src='/track.m4a';
        await new Promise((resolve,reject)=> {element.onloadedmetadata=resolve;element.onerror=()=>reject(new Error('Media metadata failed'));});
        const offset=loopEnd-0.6;
        element.currentTime=offset;
        await new Promise((resolve,reject)=> {element.onseeked=resolve;element.onerror=()=>reject(new Error('Initial seek failed'));});
        const media=ctx.createMediaElementSource(element);media.connect(capture,0,1);
        const reference=ctx.createBufferSource();reference.buffer=original;reference.loop=true;reference.loopStart=loopStart;reference.loopEnd=loopEnd;reference.connect(capture,0,0);
        const start=ctx.currentTime+0.1;reference.start(start,offset);
        const timer=setInterval(()=> {
          const at=element.currentTime; clock.push({context:ctx.currentTime,media:at,seeking:element.seeking});
          if (at>=loopEnd&&!element.seeking) {seeks.push({context:ctx.currentTime,from:at,to:loopStart+at-loopEnd});element.currentTime=loopStart+at-loopEnd;}
        },1);
        try {
          await element.play();await new Promise(resolve=>setTimeout(resolve,3500));
        } finally {
          clearInterval(timer);element.pause();element.removeAttribute('src');element.load();reference.stop();media.disconnect();reference.disconnect();capture.disconnect();await ctx.close();
        }
        return {rate:48000,start,offset,seeks,clock,chunks:chunks.map(c=>({frame:c.frame,a:Array.from(c.a),b:Array.from(c.b)}))};
      })();
    };
  },spec);
  await page.locator('button').click();
  const recording=await page.evaluate(()=>window.recording);
  // Align once in the pre-loop section, then keep that shift at the seam: no per-section re-alignment hides a seek gap.
  const base=recording.chunks[0]?.frame;
  if (base===undefined) throw new Error('No worklet samples');
  const a=[],b=[];
  for(const row of recording.chunks){const offset=row.frame-base;for(let i=0;i<row.a.length;i++)a[offset+i]=row.a[i];for(let i=0;i<row.b.length;i++)b[offset+i]=row.b[i];}
  const begin=Math.ceil(recording.start*recording.rate-base)+Math.floor(.12*recording.rate);
  const end=begin+Math.floor(.18*recording.rate);
  let best={shift:0,mse:Infinity};
  for(let shift=-12000;shift<=12000;shift++){
    let sum=0,count=0;
    for(let i=begin;i<end;i+=8){if(b[i+shift]===undefined)continue;const d=(a[i]??0)-b[i+shift];sum+=d*d;count++;}
    if(count&&sum/count<best.mse)best={shift,mse:sum/count};
  }
  const compare=(start,seconds)=> {
    let max=0,sum=0,count=0;
    for(let i=Math.floor(start*recording.rate-base);i<Math.floor((start+seconds)*recording.rate-base);i++){
      if(a[i]===undefined||b[i+best.shift]===undefined)continue;
      const d=a[i]-b[i+best.shift];max=Math.max(max,Math.abs(d));sum+=d*d;count++;
    }
    return {samples:count,maxAbs:max,rms:Math.sqrt(sum/Math.max(1,count))};
  };
  report.recording={rate:recording.rate,start:recording.start,offset:recording.offset,seeks:recording.seeks,clock:recording.clock,alignment:best,alignmentSeconds:best.shift/recording.rate,
    beforeLoop:compare(recording.start+.15,.25),loopSeam:compare(recording.start+.5,.45),afterLoop:compare(recording.start+1.1,.5),workletFrames:a.length};
  report.exact=Object.values(report.recording).filter(v=>v&&typeof v==='object'&&'maxAbs' in v).every(v=>v.maxAbs===0);
} catch(error) {report.failure=String(error);process.exitCode=1;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));report.closed=true;writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
