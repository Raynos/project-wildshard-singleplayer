// Actual KTX2 loader, compressed rock files and WebKit storage. Run through browser-lane after quiet releases.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';

const [base, out] = process.argv.slice(2);
if (!base || !out) throw new Error('Pass a built preview BASE and OUT_JSON; wrap with browser-lane.sh');
const root = resolve(import.meta.dirname, '../../..'), entry = 'ktx2-source-proof';
const source = `import * as THREE from 'three';
import {initKtx2,ktx2Texture} from ${JSON.stringify(resolve(root, 'src/engine/core/ktx2.ts'))};
import {registerGpuFiles} from ${JSON.stringify(resolve(root, 'src/engine/boot/gpuFiles.ts'))};
import {setDev} from ${JSON.stringify(resolve(root, 'src/engine/core/devMode.ts'))};
import {initializeTier} from ${JSON.stringify(resolve(root, 'src/engine/core/tier.ts'))};
import {overrideSetting} from ${JSON.stringify(resolve(root, 'src/engine/ui/Settings.ts'))};
export async function run(on){
  setDev(true); overrideSetting('memorySaver',on?'on':'off');overrideSetting('tex','ktx2');initializeTier('phone');
  const files={diffuse:'/assets/pine-hollow/astc6/tex/rock_ground/diffuse-90136f33.ktx2',
    normal:'/assets/pine-hollow/astc6/tex/rock_ground/nor_gl-78bf8132.ktx2'};
  registerGpuFiles({phone:files,desktop:files});
  const renderer=new THREE.WebGLRenderer({antialias:false}),target=new THREE.WebGLRenderTarget(64,64,{depthBuffer:false});
  renderer.setSize(64,64);renderer.setRenderTarget(target);renderer.setClearColor(0,1);initKtx2(renderer);
  const material=new THREE.MeshBasicMaterial({toneMapped:false}),geometry=new THREE.PlaneGeometry(2,2);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
  scene.add(new THREE.Mesh(geometry,material));
  const outputs=[],stages=[],pairs=[],textures=[];
  const draw=(texture)=>{material.map=texture;material.needsUpdate=true;renderer.render(scene,camera);
    const pixels=new Uint8Array(64*64*4);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);outputs.push(Array.from(pixels));};
  const record=(name)=>{stages.push({name,gl:window.__sc_gl().map(({gl,...record})=>record)});};
  renderer.render(scene,camera);record('no-texture-baseline');
  const load=async(name,size=Infinity)=>{const t=await ktx2Texture(name,size);if(!t)throw new Error('Missing KTX2 '+name);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();
    t.colorSpace=name==='diffuse'?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;textures.push(t);return t;};
  const wave=()=>new Promise(resolve=>setTimeout(resolve,30));
  for(const name of Object.keys(files)){const first=await load(name);draw(first);pairs.push({name,first});}
  record('first-wave');await wave();
  for(const pair of pairs){pair.second=await load(pair.name);draw(pair.second);}
  record('second-wave-live-originals');
  const identities=pairs.map(({name,first,second})=>({name,sameSource:first.source===second.source,
    sameGL:renderer.properties.get(first).__webglTexture===renderer.properties.get(second).__webglTexture,
    firstReleased:first.mipmaps.length===0,secondReleased:second.mipmaps.length===0}));
  for(const pair of pairs){pair.first.dispose();draw(pair.second);const clone=pair.second.clone();textures.push(clone);draw(clone);clone.dispose();}
  record('original-disposed-late-clone');await wave();
  for(const pair of pairs){const other=await load(pair.name);other.wrapS=THREE.ClampToEdgeWrapping;other.repeat.set(2.7,1.3);draw(other);}
  record('independent-samplers');await wave();
  for(const pair of pairs){const trimmed=await load(pair.name,512);draw(trimmed);}
  record('independent-mip-level');
  for(const t of textures)t.dispose();textures.length=0;record('all-owners-disposed');await wave();
  for(const pair of pairs){const late=await load(pair.name);draw(late);}
  record('late-fresh-upload-after-last-owner');
  for(const t of textures)t.dispose();material.dispose();geometry.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();
  return{outputs,stages,identities};
}`;
const built = await build({ root, configFile: false, publicDir: false, logLevel: 'error',
  plugins: [{ name: entry, resolveId: id => id === entry || id === resolve(root, entry) ? '\0' + entry : null,
    load: id => id === '\0' + entry ? source : null }],
  build: { write: false, minify: false, lib: { entry, formats: ['es'] } } });
const chunks = (Array.isArray(built) ? built : [built]).flatMap(value => value.output);
const chunk = chunks.find(value => value.type === 'chunk' && value.isEntry);
if (chunk?.type !== 'chunk') throw new Error('Missing actual KTX2 bundle');
const prefix = new URL('/g227-ktx2-source-proof/', base).href;
const url = new URL(chunk.fileName, prefix).href;
const bundled = new Map(chunks.map(value => [new URL(value.fileName, prefix).href, value]));
console.log(JSON.stringify({ modules: chunks.map(value => value.fileName) }));
const browser = await webkit.launch({ headless: true });
try {
  const results = [];
  for (const enabled of [false, true]) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
    await context.addInitScript({ content: GL_INIT });
    await context.route(prefix + '**', route => {
      const value = bundled.get(route.request().url());
      return value ? route.fulfill({ contentType: value.type === 'chunk' ? 'text/javascript' : 'application/octet-stream',
        body: value.type === 'chunk' ? value.code : Buffer.from(value.source) }) : route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => console.error('pageerror', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('browser', message.text()); });
    page.on('requestfailed', request => console.error('requestfailed', request.url(), request.failure()));
    await page.route(new URL('/g227-ktx2-source-proof.html', base).href,
      route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>KTX2 source proof</title>' }));
    await page.goto(new URL('/g227-ktx2-source-proof.html', base).href);
    results.push(await page.evaluate(async ({ url, enabled }) => (await import(url)).run(enabled), { url, enabled }));
    await context.close();
  }
  const [before, after] = results;
  let different = 0, maximum = 0, signal = 0;
  for (let shot = 0; shot < before.outputs.length; shot++) for (let index = 0; index < before.outputs[shot].length; index++) {
    const delta = Math.abs(before.outputs[shot][index] - after.outputs[shot][index]);
    if (delta) different++; maximum = Math.max(maximum, delta); signal += before.outputs[shot][index];
  }
  const compact = ({ outputs, ...result }) => ({ ...result, frames: outputs.length,
    pixelSha256: createHash('sha256').update(Buffer.from(outputs.flat())).digest('hex') });
  const second = value => value.stages.find(stage => stage.name === 'second-wave-live-originals').gl.reduce((sum, record) => sum + record.totalBytes, 0);
  const savedGLBytes = second(before) - second(after);
  const disposed = value => value.stages.find(stage => stage.name === 'all-owners-disposed').gl.reduce((sum, record) => sum + record.texBytes, 0);
  const baseline = value => value.stages.find(stage => stage.name === 'no-texture-baseline').gl.reduce((sum, record) => sum + record.texBytes, 0);
  const report = { protocol: 'Actual ktx2Texture, two encoded Pine rock files, fresh WebKit phone pages Memory saver OFF/ON. Equal and changed samplers, separate mip levels, first/last-owner disposal, late clones and fresh uploads. Byte-for-byte 64x64 RGBA readbacks; no normalization or pixel exclusions. GL includes the unchanged proof render target/geometry.',
    implementationSha256: createHash('sha256').update(readFileSync(resolve(root, 'src/engine/core/ktx2.ts'))).digest('hex'),
    memoSha256: createHash('sha256').update(readFileSync(resolve(root, 'src/engine/core/ktx2Sources.ts'))).digest('hex'),
    before: compact(before), after: compact(after), different, maximum, signal, savedGLBytes,
    pass: different === 0 && signal > 0 && savedGLBytes === 1252576 && disposed(before) === baseline(before) && disposed(after) === baseline(after)
      && after.identities.every(value => value.sameGL && value.sameSource && value.firstReleased && value.secondReleased) };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, pass: report.pass, frames: before.outputs.length, different, maximum, savedGLBytes }));
  if (!report.pass) throw new Error('Compressed source reuse changed pixels or did not remove duplicate GPU storage');
} finally { await browser.close(); }
