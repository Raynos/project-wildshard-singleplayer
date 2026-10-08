// Actual named generators + ranged texture factory, WebKit pixels and GL source sharing. No live game/Simulator.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';

const out = process.argv[2];
if (!out) throw new Error('Pass OUT_JSON; wrap with browser-lane.sh');
const root = resolve(import.meta.dirname, '../../..'), entry = 'viewmodel-proof';
const source = `import * as THREE from 'three';
import {viewmodelTexSet,makeCord,makeBoltAtlas} from ${JSON.stringify(resolve(root, 'src/engine/combat/view/ranged.ts'))};
import {setDev} from ${JSON.stringify(resolve(root, 'src/engine/core/devMode.ts'))};
import {overrideSetting} from ${JSON.stringify(resolve(root, 'src/engine/ui/Settings.ts'))};
export function run(on){
  setDev(true); overrideSetting('memorySaver',on?'on':'off');
  const renderer=new THREE.WebGLRenderer({antialias:false}),target=new THREE.WebGLRenderTarget(64,64,{depthBuffer:false});
  renderer.setSize(64,64);renderer.setRenderTarget(target);renderer.setClearColor(0x060a0e,1);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);camera.position.z=2;
  const geometry=new THREE.PlaneGeometry(2,2);const material=new THREE.MeshBasicMaterial({toneMapped:false});
  scene.add(new THREE.Mesh(geometry,material));const outputs=[],sources=new Set(),arrays=new Set(),retained=[];
  const draw=(texture)=>{material.map=texture;material.needsUpdate=true;renderer.render(scene,camera);
    const pixels=new Uint8Array(64*64*4);renderer.readRenderTargetPixels(target,0,0,64,64,pixels);outputs.push(Array.from(pixels));};
  const keep=texture=>{sources.add(texture.source);arrays.add(texture.image.data);retained.push(texture);};
  for(const name of ['walnut','brushed-steel','leather','bolt','gunmetal']){
    const first=viewmodelTexSet(name),second=viewmodelTexSet(name);
    first.map.repeat.set(1,4);second.map.repeat.set(1.6,0.9);second.map.wrapS=THREE.ClampToEdgeWrapping;
    for(const set of [first,second])for(const texture of [set.map,set.normalMap,set.armMap]){keep(texture);draw(texture);}
    first.map.dispose();first.normalMap.dispose();first.armMap.dispose();
    const late=viewmodelTexSet(name);late.map.repeat.set(2,2);
    for(const texture of [late.map,late.normalMap,late.armMap]){keep(texture);draw(texture);}
    const clone=late.map.clone();clone.repeat.set(1.6,0.9);keep(clone);draw(clone);
  }
  const cord=makeCord(),lateCord=makeCord(),bolt=makeBoltAtlas();
  for(const texture of [cord.map,cord.normalMap,lateCord.map,lateCord.normalMap,bolt.map,bolt.normalMap,bolt.armMap]){keep(texture);draw(texture);}
  const cpuBytes=[...arrays].reduce((sum,array)=>sum+array.byteLength,0);
  const liveGL=window.__sc_gl().map(({gl,...record})=>record);
  for(const texture of retained)texture.dispose();geometry.dispose();material.dispose();target.dispose();renderer.dispose();
  return{outputs,cpuBytes,sources:sources.size,gl:liveGL};
}`;
const built = await build({ root, configFile: false, publicDir: false, logLevel: 'error',
  plugins: [{ name: entry, resolveId: id => id === entry || id === resolve(root, entry) ? '\0' + entry : null,
    load: id => id === '\0' + entry ? source : null }],
  build: { write: false, minify: false, lib: { entry, formats: ['es'] } } });
const outputs = (Array.isArray(built) ? built : [built]).flatMap(value => value.output);
const chunk = outputs.find(value => value.type === 'chunk' && value.isEntry);
if (chunk?.type !== 'chunk') throw new Error('Missing actual factory bundle');
const module = `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`;
const browser = await webkit.launch({ headless: true });
try {
  const results = [];
  for (const enabled of [false, true]) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await context.addInitScript({ content: GL_INIT });
    const page = await context.newPage(); await page.goto('about:blank');
    results.push(await page.evaluate(async ({ module, enabled }) => (await import(module)).run(enabled), { module, enabled }));
    await context.close();
  }
  const [before, after] = results;
  let different = 0, maximum = 0, signal = 0;
  for (let shot = 0; shot < before.outputs.length; shot++) for (let index = 0; index < before.outputs[shot].length; index++) {
    const delta = Math.abs(before.outputs[shot][index] - after.outputs[shot][index]);
    if (delta) different++; maximum = Math.max(maximum, delta); signal += before.outputs[shot][index];
  }
  const compact = ({ outputs, ...value }) => ({ ...value, frames: outputs.length,
    pixelSha256: createHash('sha256').update(Buffer.from(outputs.flat())).digest('hex') });
  const report = { protocol: 'Actual seeded generators/factory, WebKit64x64 offscreen pixels. Memory saver OFF/ON in fresh pages. Independent repeats/wraps, first-owner disposal, late owners and clones; all map/normal/ARM planes. No normalization or pixel exclusions.',
    implementationSha256: createHash('sha256').update(readFileSync(resolve(root, 'src/engine/combat/view/ranged.ts'))).digest('hex'),
    sourceMemoSha256: createHash('sha256').update(readFileSync(resolve(root, 'src/engine/player/viewmodelSources.ts'))).digest('hex'),
    before: compact(before), after: compact(after), different, maximum, signal,
    pass: different === 0 && signal > 0 && before.cpuBytes > after.cpuBytes && before.sources > after.sources };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, pass: report.pass, frames: before.outputs.length, different, maximum,
    beforeCPU: before.cpuBytes, afterCPU: after.cpuBytes,
    beforeGL: before.gl.map(value => value.totalBytes), afterGL: after.gl.map(value => value.totalBytes) }));
  if (!report.pass) throw new Error('Viewmodel source sharing changed pixels or did not remove duplicate payload');
} finally { await browser.close(); }
