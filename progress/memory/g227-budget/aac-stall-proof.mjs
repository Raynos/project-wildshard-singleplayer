// Actual defining bounded decoder / adapter versus whole-file decoder, reference PCM diagnostic only.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import ts from '@typescript/typescript6';
import { webkit, devices } from 'playwright';
const [out, genre = 'piano', stall = '2'] = process.argv.slice(2);
const stallSeconds = Number(stall);
if (!Number.isFinite(stallSeconds) || stallSeconds < .25 || stallSeconds > 8) throw new Error('Invalid diagnostic stall');
if (!out || !['piano', 'folk', 'orchestral'].includes(genre)) throw new Error('Pass OUT_JSON [piano|folk|orchestral], wrap with browser-lane.sh');
const modules = ['app/ownership', 'app/scopeEnvironment', 'app/scopedProperty', 'app/scope', 'audio/ownership', 'audio/aacIndex', 'audio/aacPull', 'audio/aacNative', 'audio/aacWindows', 'audio/aacTrack', 'audio/aacSource'];
const code = 'const __modules = {};\n' + modules.map(name => {
  const source = readFileSync(`src/engine/${name}.ts`, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const exports = [...compiled.matchAll(/^export (?:async )?(?:function|class|const|let) (\w+)/gm)].map(match => match[1]);
  const body = compiled.replace(/^import \{([^}]+)\} from ['"]([^'"]+)['"];$/gm, (_all, bindings, path) =>
    `const {${bindings.replace(/ as /g, ': ')}} = __modules[${JSON.stringify(posix.normalize(posix.join(posix.dirname(name), path)))}];`)
    .replace(/^export /gm, '');
  return `__modules[${JSON.stringify(name)}] = (() => {${body}\nreturn {${exports.join(',')}};})();`;
}).join('\n') + '\nObject.assign(globalThis,__modules["app/scope"],__modules["audio/aacTrack"],__modules["audio/aacSource"]);';
const spec = JSON.parse(readFileSync(`public/assets/music/${genre}/music.json`, 'utf8')).slots.title;
const bytes = readFileSync(`public/assets/music/${genre}/${spec.full}`);
const report = { protocol: 'Actual bounded AacSource scheduler with native AAC, scoped windows and context-clock pumps versus original whole-file source; same fades and authored loop. Offline only, no native saving claim.', genre, sourceSha256: createHash('sha256').update(bytes).digest('hex'), errors: [] };
const worklet = `class Compare extends AudioWorkletProcessor {
  constructor() { super(); this.begin=Infinity; this.end=Infinity; this.count=0; this.sum=0; this.max=0; this.first=null;
    this.port.onmessage=event=>{this.begin=event.data.begin;this.end=event.data.end;}; }
  process(inputs, outputs) {
    for(let i=0;i<128;i++) if(currentFrame+i>=this.begin&&currentFrame+i<this.end) {
      for(let channel=0;channel<2;channel++) {
        const a=inputs[0]?.[channel]?.[i]??0,b=inputs[1]?.[channel]?.[i]??0,d=a-b;
        if(d!==0&&this.first===null)this.first=currentFrame+i;
        this.count++;this.sum+=d*d;this.max=Math.max(this.max,Math.abs(d));
      }
    }
    for(const output of outputs)for(const channel of output)channel.fill(0);
    if(currentFrame>=this.end) {this.port.postMessage({samples:this.count,maxAbs:this.max,rms:Math.sqrt(this.sum/this.count),firstDifferenceFrame:this.first});this.end=Infinity;}
    return true;
  }
} registerProcessor('compare',Compare);`;
const server = createServer((req, res) => {
  if(req.url==='/track')res.end(bytes);
  else if(req.url==='/compare.js'){res.setHeader('Content-Type','application/javascript');res.end(worklet);}
  else res.end('<!doctype html><button>Silent AAC scheduler stall proof</button>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No diagnostic origin');
let browser;
try {
  browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${address.port}`); await page.addScriptTag({ content: code });
  await page.evaluate(spec => {
    document.querySelector('button').onclick=()=>{window.recording=(async()=>{
      const ctx=new AudioContext({sampleRate:48000});await ctx.resume();
      const scope=new Scope('AAC.stall'),failures=[],encoded=new Uint8Array(await(await fetch('/track')).arrayBuffer());
      let capture,source;
      try {
        const reference=await new OfflineAudioContext(2,1,48000).decodeAudioData(encoded.slice().buffer);
        const track=await AacTrack.prepare(encoded,spec.loopStart,spec.loopEnd,()=>Promise.reject(new Error('No whole fallback')));
        if(!track)throw new Error('Native AAC ineligible');
        await ctx.audioWorklet.addModule('/compare.js');
        capture=new AudioWorkletNode(ctx,'compare',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[1]});capture.connect(ctx.destination);
        const result=new Promise(resolve=>{capture.port.onmessage=event=>resolve(event.data);});
        const original=ctx.createBufferSource();original.buffer=reference;original.loop=true;original.loopStart=spec.loopStart;original.loopEnd=spec.loopEnd;original.connect(capture,0,0);
        const bounded=ctx.createGain();bounded.connect(capture,0,1);
        const start=ctx.currentTime+.15;
        source=new AacSource(track,{context:ctx,output:bounded,scope,ended:()=>{},failed:error=>failures.push(String(error))},start);
        await source.pump();original.start(start);
        capture.port.postMessage({begin:Math.ceil((start+.05)*48000),end:Math.ceil((start+spec.stallSeconds+1.2)*48000)});
        await new Promise(resolve=>setTimeout(resolve,450));
        const before=ctx.currentTime,end=performance.now()+spec.stallSeconds*1000;
        while(performance.now()<end){} // Deliberate diagnostic main-thread stall; no production work is changed.
        const after=ctx.currentTime;
        await source.pump();
        const comparison=await result;
        original.stop();original.disconnect();original.buffer=null;bounded.disconnect();
        return {comparison,failures,blockedContextSeconds:after-before,peakWindows:source.peakWindows,rate:ctx.sampleRate};
      } finally {scope.dispose();capture?.disconnect();await ctx.close();}
    })();};
  },{...spec,stallSeconds});
  await page.locator('button').click();
  report.result=await page.evaluate(()=>window.recording);
  report.protocol='Actual native AAC short-window source versus whole-file source captured concurrently by a silent worklet under a deliberate main-thread stall (duration recorded below). Diagnostic only; no native saving credit.';

} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); report.closed = true; writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); }
