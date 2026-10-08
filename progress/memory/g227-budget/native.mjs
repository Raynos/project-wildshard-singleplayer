// G227 one cold Simulator grid route, kernel footprint and labelled GL at entered poses.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { saveFixtureCode } from '../../../scripts/debug-settings.mjs';
import { gridFloorDocumentIdentity, gridFloorPlans, runFloorGridRoute } from '../../../scripts/frame-floor-grid.mjs';

const [base, out, dist, routeMode = 'full'] = process.argv.slice(2), udid = process.env.SIM_UDID;
if (!dist) throw new Error('Pass the owned preview dist directory for the preboot diagnostic helper');
const fixtures = [
  {scope:'global',key:'settings',data:{tier:'phone',fps:'auto',tex:'auto',memorySaver:'off',volume:0},merge:true},
  {scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}},
  {scope:'device',key:'devMode',data:true},
].map(saveFixtureCode).join(';');
const WASM_INIT = `(() => {
 if(window.__g227Wasm) return; window.__g227Wasm=[];
 const record=(instance,source) => { for(const [name,value] of Object.entries(instance.exports)) if(value instanceof WebAssembly.Memory && !window.__g227Wasm.some(row=>row.memory.deref()===value)) window.__g227Wasm.push({source,name,memory:new WeakRef(value)}); };
 for(const name of ['instantiate','instantiateStreaming']) { const original=WebAssembly[name]; WebAssembly[name]=function(...args){return original.apply(this,args).then(result=>{record(result.instance ?? result,name);return result;});}; }
 const Original=WebAssembly.Instance;
 WebAssembly.Instance=new Proxy(Original,{construct(target,args,newTarget){const instance=Reflect.construct(target,args,newTarget);record(instance,'Instance');return instance;}});
})();`;
const helper = new URL('g227-safari.html', base).href;
const documentHtml = readFileSync(dist + '/index.html','utf8').replace('<head>', '<head><script>' + GL_INIT + ';' + WASM_INIT + ';' + fixtures + ';window.__wildshardHarness={seed:357,capture:null};window.__gridAdmissionLongTasks=[];window.__g227Errors=[];window.addEventListener("error",e=>window.__g227Errors.push(String(e.message)));window.addEventListener("unhandledrejection",e=>window.__g227Errors.push(String(e.reason)));<\/script>');
writeFileSync(dist + '/index.html', documentHtml);
writeFileSync(dist + '/g227-safari.html', documentHtml);
if (!udid) throw new Error('Run through sim-lane.sh');
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'One cold Safari Simulator route. Three settled one-second kernel physical-footprint samples per pose; live labelled GL at the same pose. Relative evidence, not physical-phone cap proof.',
  snapshots: [], routes: [] };
const save = () => writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
const phaseFile = out + '.phase', nativeFile = out + '.native.jsonl';
writeFileSync(phaseFile, 'loading');
const simctl = args => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let inspector, sampler, proxy;
let evalSequence = 0;
const snapshotExpression = `(() => {
      const api = window.__wildshard, grid = api.shard.grid;
      const roots = [];
      api.world.game.rootScene.traverse(object => {
        if (object.isMesh && object.name.startsWith('grid-')) roots.push({ name: object.name, visible: object.visible,
          vertices: object.geometry?.attributes.position?.count, indices: object.geometry?.index?.count });
      });
      const allocations = new Map(), textures = new Map(); let next = 0;
      const addArray = (value, user, role) => {
        if (!ArrayBuffer.isView(value)) return;
        const buffer = value.buffer;
        let item = allocations.get(buffer);
        if (!item) { item = { id: ++next, bytes: buffer.byteLength, uses: [] }; allocations.set(buffer, item); }
        const key = user + ':' + role;
        if (!item.uses.some(use => use.key === key)) item.uses.push({ key, user, role, viewBytes: value.byteLength });
      };
      const original = window.__sc_gl().flatMap(c => c.resources);
      const textureHandles = new Map();
      api.world.game.rootScene.traverse(object => {
        const names = []; let parent = object;
        while (parent) { names.unshift(parent.name || parent.type); parent = parent.parent; }
        const user = names.join('/');
        if (object.geometry) {
          for (const [role, attribute] of Object.entries(object.geometry.attributes)) addArray(attribute.array ?? attribute.data?.array, user, role);
          addArray(object.geometry.index?.array, user, 'index');
        }
        addArray(object.instanceMatrix?.array, user, 'instanceMatrix'); addArray(object.instanceColor?.array, user, 'instanceColor');
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (!material) continue;
          const values = [...Object.values(material), ...Object.values(material.uniforms ?? {}).map(uniform => uniform?.value)].flat();
          for (const texture of values) {
            if (!texture?.isTexture) continue;
            let item = textures.get(texture);
            if (!item) {
              item = { uuid: texture.uuid, name: texture.name, uses: [], imageKind: texture.image?.constructor?.name,
                width: texture.image?.width, height: texture.image?.height, depth: texture.image?.depth };
              textures.set(texture, item);
              const handle = api.world.game.renderer.properties.get(texture).__webglTexture;
              if (handle) { textureHandles.set(texture.uuid, handle); window.__sc_label_gl(handle, 'g227:scene-texture', texture.uuid); }
            }
            if (!item.uses.includes(user)) item.uses.push(user);
            addArray(texture.image?.data, user, 'texture:' + texture.uuid);
            for (const mip of texture.mipmaps ?? []) addArray(mip.data, user, 'mip:' + texture.uuid);
          }
        }
      });
      const linked = window.__sc_gl().map(({gl, ...context}) => context);
      const usageById = new Map(linked.flatMap(c => c.resources).filter(r => r.owner === 'g227:scene-texture').map(r => [r.id, r.asset]));
      const originalById = new Map(original.map(r => [r.id, r]));
      for (const resource of linked.flatMap(c => c.resources)) {
        const originalResource = originalById.get(resource.id);
        if (originalResource) { resource.owner = originalResource.owner; resource.asset = originalResource.asset; resource.labelled = originalResource.labelled; }
        const uuid = usageById.get(resource.id);
        if (uuid) {
          resource.sceneTextureUuid = uuid;
          const tag = originalById.get(resource.id);
          if (tag) window.__sc_label_gl(textureHandles.get(uuid), tag.owner, tag.asset);
        }
      }
      const census = { gl: linked, cpuAllocations: [...allocations.values()], textures: [...textures.values()],
        note: 'GPU allocations plus deduplicated directly retained scene ArrayBuffers. ImageBitmap/canvas/native costs are not inferred from dimensions.' };
      return { census, state: grid.state(), residency: grid.residency(), road: grid.roadResident(), roots, longTasks: window.__gridAdmissionLongTasks,
        runtime: { texture: api.world.game.level.assets?.texture, level: api.world.game.level.id },
        wasm: (window.__g227Wasm ?? []).map(({source,name,memory})=>({source,name,bytes:memory.deref()?.buffer.byteLength ?? 0})), reveal: window.__wsReveal, originDrift: window.__frameFloorGridOriginDrift };
})()`;
try {
  try { simctl(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Cold first launch. */ }
  report.stage = 'cold-version'; save();
  simctl(['openurl', udid, `${base}version.json`]);
  await sleep(6000);
  const socket = simctl(['getenv', udid, 'RWI_LISTEN_SOCKET']).trim();
  proxy = spawn('ios_webkit_debug_proxy', ['-s', `unix:${socket}`, '-c', 'null:9221,:9232-9240', '-F'], { stdio: 'ignore' });
  const connect = async url => {
    inspector?.close(); inspector = webkit(await safariPage(url)); await inspector.opened; await sleep(600);
    return evaluator(inspector.raw);
  };
  let evaluate = await connect(`${base}version.json`);
  report.stage = 'cold-reset'; save();
  await evaluate(`(async () => {for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();for(const k of await caches.keys()) await caches.delete(k);localStorage.clear();sessionStorage.clear();return true;})()`);
  await evaluate(`(() => {${saveFixtureCode({ scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto', memorySaver: 'off' }, merge: true })};${saveFixtureCode({ scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } })};${saveFixtureCode({ scope: 'device', key: 'devMode', data: true })};return true;})()`);
  sampler = spawn('python3', ['scripts/sim-mem-phases.py', '--device', udid, '--phase-file', phaseFile, '--out', nativeFile, '--max', '1200'], { stdio: 'ignore' });
  if (routeMode === 'control') {
    await evaluate(`(() => { ${GL_INIT}; return true; })()`);
    await evaluate(`(() => { const gl=document.createElement('canvas').getContext('webgl2'); const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,1,1); gl.finish(); window.__g227WarmGL={gl,texture}; return true;})()`);
    await sleep(3000);
    report.stage='isolated-gl-control';save();
    report.glFootprintControl=await footprintControl(evaluate);save();
    await evaluate(`(() => { const {gl,texture}=window.__g227WarmGL;gl.deleteTexture(texture);gl.getExtension('WEBGL_lose_context')?.loseContext();delete window.__g227WarmGL;return true;})()`);
  } else {
  report.stage = 'title-load'; save();
  simctl(['openurl', udid, helper]);
  await sleep(3000);
  evaluate = await connect(helper);
  const until = async (expression, ms = 180000) => {
    for (const started = Date.now(); Date.now() - started < ms;) { if (await evaluate(expression)) return; await sleep(500); }
    throw new Error('Readiness timed out: ' + expression);
  };
  await until("Boolean(document.querySelector('.ws-main-grid'))");
  report.stage = 'grid-tap'; save();
  await evaluate("(setTimeout(() => document.querySelector('.ws-main-grid').click(),100),true)");
  await sleep(3000); evaluate = await connect(helper);
  report.stage = 'grid-load'; save();
  await until("!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)", 240000);
  await evaluate('(window.__wildshard.world.hud.enterNow(),true)');
  await until('window.__wsReveal?.endedMs != null', 45000);
  const documentOrigin = await evaluate(`(${gridFloorDocumentIdentity.toString()})()`); report.documentOrigin = documentOrigin;
  const snapshot = async label => {
    report.stage = label; writeFileSync(phaseFile, label); save(); await sleep(5000);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1100);
      const lines = readFileSync(nativeFile, 'utf8').split('\n').filter(Boolean);
      const latest = lines.slice(0, -1).map(line => JSON.parse(line)).findLast(row => row.type === 'sample' && row.phase === label);
      if (!latest) throw new Error('Missing native sample');
      const [pid, values] = Object.entries(latest.pids).sort((a, b) => b[1][0] - a[1][0])[0];
      samples.push({ at: latest.t, pid: Number(pid), footprintBytes: values[0], intervalPeakBytes: values[1], gpuProcessBytes: latest.gpu });
    }
    const value = await evaluate(snapshotExpression);
    const sorted = samples.map(s => s.footprintBytes).sort((a, b) => a - b);
    const vmmapPath = out.replace(/\.json$/u, '') + '.' + label + '.vmmap.txt';
    let vmmap;
    try { vmmap = execFileSync('vmmap', ['-summary', String(samples[2].pid)], { encoding: 'utf8', timeout: 30000, maxBuffer: 8e6 }); writeFileSync(vmmapPath, vmmap); }
    catch (error) { vmmap = String(error); }
    report.snapshots.push({ label, ...value, native: { samples, medianBytes: sorted[1], minBytes: sorted[0], maxBytes: sorted[2], vmmapPath, vmmapError: vmmap.startsWith('Error:') ? vmmap : null } });
    save(); console.log(label, 'native', sorted[1] / 1e6, 'GL', value.census.gl.reduce((s, c) => s + c.totalBytes, 0) / 1e6, 'model', value.residency.cost.playing / 1e6);
  };
  await snapshot('home-settled');
  const state = await evaluate('window.__wildshard.shard.grid.state()');
  const page = { evaluate: expression => evaluate(expression, 180000) };
  const home = state.cells.find(cell=>cell.instance===state.home), directNalati=state.cells.find(cell=>cell.slug==='nalati-grasslands');
  if (!home || !directNalati) throw new Error('Missing home/Nalati catalogue cell');
  const plans = routeMode.startsWith('nalati') ? [{name:'nalati-direct',from:home.instance,to:directNalati.instance,
    start:{x:230,z:0},waypoints:[{x:directNalati.cell[0]*555-230,z:directNalati.cell[1]*555}],requiredResidents:[directNalati.instance]}]
    : gridFloorPlans(state, 'runtime-travel');
  for (const plan of plans) {
    report.stage = 'route:' + plan.name; writeFileSync(phaseFile, report.stage); save();
    report.routes.push(await runFloorGridRoute(page, plan, documentOrigin));
    await snapshot(plan.to + '-entry');
    const cell = state.cells.find(c => c.instance === plan.to);
    report.routes.push(await runFloorGridRoute(page, { name: plan.to + '-centre', from: plan.to, to: plan.to,
      waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }, documentOrigin));
    await snapshot(plan.to + '-centre');
  }
  // A real-input road-only counterfactual, far beyond the former source's retained ring.
  // It measures the page/platform/cache remainder after owned runtime retirement, not hidden meshes.
  const nalati = state.cells.find(cell => cell.slug === 'nalati-grasslands');
  if (!nalati) throw new Error('Missing Nalati catalogue cell');
  report.stage = 'route:neutral-road'; save();
  report.routes.push(await runFloorGridRoute(page, {name:'neutral-road',from:nalati.instance,to:null,
    waypoints:[{x:277.5,z:0},{x:277.5,z:-277.5},{x:-277.5,z:-277.5}],requiredResidents:[]},documentOrigin));
  await until('window.__wildshard.shard.grid.state().live.live.residents.length === 0',90000);
  await snapshot('neutral-road');
  if(routeMode === 'nalati-heap') {
    // Do not force collection before any original route pose. The post-route heap snapshot/GC is a separate experiment.
    report.stage='heap-snapshot';save();
    try {
      await inspector.send('Heap.enable');
      const heap=await inspector.send('Heap.snapshot');
      const path=out.replace(/\.json$/u,'')+'.heap.json';writeFileSync(path,heap.snapshotData);
      report.heap={path,timestamp:heap.timestamp};save();
      await snapshot('neutral-road-after-heap');
    } catch(error){report.heap={error:String(error)};save();}
  } else { report.glFootprintControl = await footprintControl(evaluate); save(); }
  }
} catch (error) { report.diagnostic = await inspector?.raw('JSON.stringify({url:location.href,origin:performance.timeOrigin,token:window.__frameFloorGridDocumentToken,stop:window.__frameFloorGridStop,body:document.body.innerText.slice(-4000)})').catch(() => null); report.failure = String(error); process.exitCode = 1; console.error(report.failure); }
finally {
  report.errors = await inspector?.raw('JSON.stringify(window.__g227Errors ?? [])').catch(() => null);
  inspector?.close(); proxy?.kill('SIGTERM'); writeFileSync(phaseFile, 'done');
  if (sampler) { await Promise.race([new Promise(resolve => sampler.once('exit', resolve)), sleep(3000)]); if (sampler.exitCode === null) sampler.kill('SIGTERM'); }
  try { simctl(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* Already exited. */ }
  report.closed = true; save();
}

function evaluator(raw, observe = () => undefined) {
  return async (expression, timeout = 35000) => {
    const key = `__frameFloorEval${++evalSequence}`;
    const origin = await raw(`globalThis.__g227DocumentToken ??= crypto.randomUUID(); globalThis[${JSON.stringify(key)}] = {done:false}; Promise.resolve().then(() => (${expression})).then(value => {globalThis[${JSON.stringify(key)}] = {done:true,value};}, error => {globalThis[${JSON.stringify(key)}] = {done:true,error:String(error)};}); JSON.stringify({timeOrigin:performance.timeOrigin,token:globalThis.__g227DocumentToken})`);
    const identity = JSON.parse(origin);
    const start = Date.now();
    try {
      while (Date.now() - start < timeout) {
        const value = await raw(`JSON.stringify({origin:performance.timeOrigin,token:globalThis.__g227DocumentToken,state:globalThis[${JSON.stringify(key)}] ?? null,progress:window.__frameFloorGridProgress?.() ?? null})`);
        const envelope = typeof value === 'string' ? JSON.parse(value) : null;
        if (envelope?.token !== identity.token) throw Object.assign(new Error('Frame floor document changed during evaluation (navigation or graphics recovery); measurement cannot continue'), { documentOrigin: envelope?.origin });
        report.evaluationOriginDriftMaxMs = Math.max(report.evaluationOriginDriftMaxMs ?? 0, Math.abs(envelope.origin - identity.timeOrigin));
        if (envelope.progress) observe(envelope.progress);
        const state = envelope.state;
        if (state?.done) { if (state.error) throw new Error(state.error); return state.value; }
        await sleep(100);
      }
      throw new Error(`Browser evaluation timed out: ${expression.slice(0, 80)}`);
    } finally { await raw(`delete globalThis[${JSON.stringify(key)}]`).catch(() => { /* A navigated page may have dropped the evaluation envelope. */ }); }
  };
}
function webkit(wsUrl) {
  const ws = new WebSocket(wsUrl), pending = new Map();
  let seq = 0, target = null;
  const opened = new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  const inner = (message) => {
    const waiter = pending.get(message.id);
    if (waiter) { pending.delete(message.id); clearTimeout(waiter.timer); if (message.error) waiter.reject(new Error(message.error.message)); else waiter.done(message.result); }
  };
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === 'Target.targetCreated' && message.params.targetInfo.type === 'page') target = message.params.targetInfo.targetId;
    else if (message.method === 'Target.didCommitProvisionalTarget') target = message.params.newTargetId;
    else if (message.method === 'Target.dispatchMessageFromTarget') inner(JSON.parse(message.params.message));
    else inner(message);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Web Inspector timed out: ${method}`)); }, method === 'Heap.snapshot' ? 120000 : 10000);
    pending.set(id, { done: resolve, reject, timer });
    const message = { id, method, params };
    ws.send(JSON.stringify(target ? { id: ++seq, method: 'Target.sendMessageToTarget', params: { targetId: target, message: JSON.stringify(message) } } : message));
  });
  return { opened, send, raw: async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.wasThrown) throw new Error(result.result?.description ?? 'Safari evaluation threw');
    return result.result?.value;
  }, close: () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Inspector closed')); } pending.clear(); ws.close(); } };
}
async function safariPage(base) {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    for (let port = 9232; port <= 9240; port++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(500) })).json();
        const page = pages.find((p) => p.url?.startsWith(base));
        if (page) return page.webSocketDebuggerUrl;
      } catch { /* Proxy discovery has not announced the Simulator yet. */ }
    }
    await sleep(200);
  }
  throw new Error('Simulator Safari page not exposed by ios_webkit_debug_proxy (ports 9232–9240)');
}

async function footprintControl(evaluate) {
  // A separate offscreen allocation experiment, after all measured route poses.
  // Compare the same WebContent PID and the separately sampled GPU process, then delete everything.
  const controlSample = async label => {
    writeFileSync(phaseFile, label); await sleep(3000);
    const samples = [];
    for (let i = 0; i < 3; i++) {
      await sleep(1100);
      const rows = readFileSync(nativeFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      const latest = rows.findLast(row => row.type === 'sample' && row.phase === label);
      const [pid, values] = Object.entries(latest.pids).sort((a,b) => b[1][0] - a[1][0])[0];
      samples.push({pid:Number(pid),webContentBytes:values[0],gpuProcessBytes:latest.gpu});
    }
    return { samples, webContentBytes: samples.map(s=>s.webContentBytes).sort((a,b)=>a-b)[1],
      gpuProcessBytes: samples.map(s=>s.gpuProcessBytes).sort((a,b)=>a-b)[1] };
  };
  const result = {protocol:'After route poses, a separate offscreen RGBA8 4096x4096 texture (67,108,864 bytes), full-surface shader draw/finished, then deleted. No texture CPU upload. WC and GPU-process physical footprints sampled independently.'};
  result.before = await controlSample('gl-control-before'); 
  result.allocatedBytes = await evaluate(`(() => {
    const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('No WebGL2 control context');
    const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D,texture); gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,4096,4096);
    gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete GL control allocation');
    const shader = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('Control shader failed'); return s; };
    const vertex=shader(gl.VERTEX_SHADER,'#version 300 es\\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}');
    const fragment=shader(gl.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;out vec4 colour;void main(){colour=vec4(fract(gl_FragCoord.x*.017),fract(gl_FragCoord.y*.021),fract(gl_FragCoord.x*gl_FragCoord.y*.003),1);}');
    const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Control program failed');
    gl.useProgram(program);gl.viewport(0,0,4096,4096);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();
    gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
    const pixel=new Uint8Array(4);gl.readPixels(1777,1555,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);window.__g227ControlPixel=[...pixel];
    if (gl.getError() !== gl.NO_ERROR) throw new Error('GL control allocation failed');
    window.__g227GLControl = {canvas,gl,texture,framebuffer}; return 4096*4096*4;
  })()`);
  result.during = await controlSample('gl-control-during');
  result.pixel = await evaluate('window.__g227ControlPixel');
  await evaluate('(() => { const bytes=new Uint8Array(67108864);for(let i=0;i<bytes.length;i+=4096)bytes[i]=1;window.__g227CPUControl=bytes;return bytes.length;})()');
  result.cpuPositive = await controlSample('cpu-control-positive');
  await evaluate('(delete window.__g227CPUControl,true)'); 
  await evaluate(`(() => { const {gl,texture,framebuffer}=window.__g227GLControl; gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture); gl.finish(); gl.getExtension('WEBGL_lose_context')?.loseContext(); delete window.__g227GLControl; return true;})()`);
  result.after = await controlSample('gl-control-after'); 
  return result;
}
