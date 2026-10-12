import * as THREE from 'three';
import { loadGraphCompiler } from '../../../src/engine/render/graphBackend.ts';
import { coarseTileMask } from '../../../src/engine/world/coarseTileMask.ts';
import { Scope } from '../../../src/engine/app/scope.ts';
import { patchShader } from '../../../src/engine/render/shaderPatches.ts';
import { probeCompressedMips } from '../../../src/engine/render/ktx2Probe.ts';
import pastel from '../../../src/shards/pastel-plain/data/rock.graph.json';
import ink from '../../../src/shards/ink-cel-valley/data/rock.graph.json';
import { compressionControls } from './ktx-controls.js';

const kind = location.hash.slice(1) || 'pastel-plain';
const log = [];
for (const level of ['error', 'warn']) {
  const original = console[level].bind(console);
  console[level] = (...args) => { log.push({level, text: args.map(String).join(' ')}); original(...args); };
}
while (!innerWidth || !innerHeight) await new Promise(requestAnimationFrame);
const renderer = new THREE.WebGLRenderer({antialias:false, preserveDrawingBuffer:true});
const phoneWidth=402,phoneHeight=874; // Fixed iPhone 16 Pro profile, independent of Safari's toolbar animation.
renderer.setPixelRatio(2);
renderer.setSize(phoneWidth, phoneHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(renderer.domElement);
const gl = renderer.getContext();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#182333');
scene.add(new THREE.HemisphereLight(0xbecaff, 0x807459, 1.4));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(-20, 40, 25); scene.add(sun);
const camera = new THREE.OrthographicCamera(-46, 46, 46 * phoneHeight / phoneWidth, -46 * phoneHeight / phoneWidth, 1, 400);
camera.position.set(-187.5, 120, -110);
camera.lookAt(-187.5, 0, -187.5); camera.updateMatrixWorld();
const root = new THREE.Group(); scene.add(root);
const geometry = new THREE.IcosahedronGeometry(12, 1);
let material;
let outline = null;
let addOutline = null;
if (kind === 'classic') material = new THREE.MeshStandardMaterial({color:0xb1a389, roughness:0.9});
else if (kind === 'raw') material = new THREE.RawShaderMaterial({
  glslVersion: THREE.GLSL3, defines:{USE_INSTANCING:''},
  vertexShader:'precision highp float;\nin vec3 position;in mat4 instanceMatrix;uniform mat4 modelMatrix;uniform mat4 modelViewMatrix;uniform mat4 projectionMatrix;\nvoid main(){vec3 transformed=position;\n#include <project_vertex>\n}',
  fragmentShader:'precision highp float;\nout vec4 colour;void main(){\n#include <clipping_planes_fragment>\ncolour=vec4(.65,.52,.4,1.);}',
});
else {
  const compiler = await loadGraphCompiler(renderer);
  const compiled = compiler.compileGraph(kind === 'ink-cel-valley' ? ink : pastel);
  material = compiled.material;
  outline = compiled.outline;
  addOutline = compiler.attachOutline;
}
const mesh = new THREE.InstancedMesh(geometry, material, 4);
for (let i = 0; i < 4; i++) {
  const transform = new THREE.Matrix4().compose(
    new THREE.Vector3(-218.75 + (i % 2) * 62.5, 9, -218.75 + Math.floor(i / 2) * 62.5),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.13 * i, 0.4 * i, 0.07 * i)),
    new THREE.Vector3(1.1, 0.85, 0.95));
  mesh.setMatrixAt(i, transform);
}
mesh.instanceMatrix.needsUpdate = true; root.add(mesh);
if (outline !== null) addOutline(mesh, outline);
const pixels = () => {
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
  return data;
};
const firstReference = pixels();
material.dispose(); outline?.dispose();
const reference = pixels();
const referenceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',reference))).map(b=>b.toString(16).padStart(2,'0')).join('');
const referenceShader=material._latestBuilder?.fragmentShader;
// Drop warmed base programs: the old node patch must actually compile, not hit an
// unmasked program with the same node cache key. The copied material remains valid.
material.dispose(); outline?.dispose();
const scope = new Scope('test.graph-coarse-mask');
const setExcluded = coarseTileMask(root, 0, 0, scope);
let classicShader = null;
if (kind === 'classic') patchShader(mesh.material, 'test.capture-classic-source', 1000, (shader) => {
  classicShader = {vertex:shader.vertexShader,fragment:shader.fragmentShader};
}, {scope});
setExcluded(new Set());
const none = pixels();
const maskedShader=mesh.material._latestBuilder?.fragmentShader;
const difference = (a, b) => {
  let bytes = 0, pixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    let changed = false;
    for (let c = 0; c < 4; c++) if (a[i+c] !== b[i+c]) { bytes++; changed = true; }
    if (changed) pixels++;
  }
  return {bytes, pixels};
};
const noMaskDifference = difference(reference, none);
const quadrants = [];
for (let q = 0; q < 4; q++) {
  setExcluded(new Set([q]));
  quadrants.push({quadrant:q, ...difference(none, pixels())});
}
setExcluded(new Set([0,1,2,3]));
const all = pixels();
setExcluded(new Set());
pixels();
const shot = renderer.domElement.toDataURL('image/png');
const probeCanvas = document.createElement('canvas');
const probeGl = probeCanvas.getContext('webgl2', {antialias:false});
const probe = probeGl === null ? null : probeCompressedMips(probeGl);
const controls = probeGl === null ? null : compressionControls(probeGl);
probeGl?.getExtension('WEBGL_lose_context')?.loseContext();
const result = {
  kind, source:__FIXTURE_VERSION__, size:[gl.drawingBufferWidth,gl.drawingBufferHeight],
  noMaskDifference, quadrants, allDifference:difference(none,all), errors:log, classicShader,
  nodeShader:{reference:referenceShader,masked:maskedShader},
  referenceRebuildDifference:difference(firstReference,reference),
  referenceHash,
  glError:gl.getError(), shot,
  renderer:gl.getParameter(gl.RENDERER), vendor:gl.getParameter(gl.VENDOR),
  extensions:gl.getSupportedExtensions(), probe, controls,
};
scope.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
window.graphMaskResult = result;
await fetch('/result', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)});
