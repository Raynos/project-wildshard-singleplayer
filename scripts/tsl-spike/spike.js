// SF59 step 1, the TSL spike (SHARD-PLATFORM SF59, G155–G157). A MEASUREMENT TOOL, NOT GAME CODE: bundled by
// scripts/tsl-spike/run.mjs (vite), opened in one muted headless Chromium (desktop) and in the iOS Simulator's Safari
// (phone tier). Deletable as one folder; nothing in src/ imports it.
//
// The question (G156): can three r186's TSL node materials run inside today's WebGLRenderer (WebGLNodesHandler) beside
// the engine's patched family materials, instanced, at the frame floor? The page mirrors the engine's frame setup
// (Game.ts: NoToneMapping, sRGB output, PCF shadows, the scene drawn into a half-float target, then a screen pass) and
// draws one scene per variant (the location hash picks it; the game is never involved):
//   family     2,500 instanced boxes + ground, all the PBR family with SF56's measure layer (compilePbr), GLSL post
//   tsl        the boxes as a TSL MeshStandardNodeMaterial re-expressing the measure layer, the ground still the family
//              (both kinds in one frame), the engine height fog as a TSL epilogue, GLSL post
//   tsl-raw    as tsl through the stock handler (no colour-space fix): the parity cost of the handler's output transform
//   tsl-post   as tsl, the screen pass a TSL node graph (grade + filmic + vignette) instead of the GLSL pass
//   tsl-sway   as tsl-post, plus a vertex-offset stage (wind sway per instance)
//   plain      the boxes as a stock MeshStandardMaterial; tsl-plain as a stock MeshStandardNodeMaterial (+ the fog
//              epilogue): the cost of TSL's own lighting and shadow path, apart from the ported graph
//   tsl-pcf    as tsl, but the sun's node filter is three's stock 5-tap PCF instead of the engine tent: shows the parity
//              metric sees the shadow filter (SF59 step 2)
//   family-csm / tsl-csm    the sun as the sky rig builds it: three CSM cascades (fade on), the CSM light block, the
//              E147 fade ghosts; the node boxes gated by the engine's cascade light node (SF59 step 2)
//   family-fade / tsl-fade  the same, frozen half way through a sun step (uSunFade 0.5: the ghosts' shadows mix in)
//   graph      as tsl, but the boxes are the material graph COMPILER's output (SF59 step 3): the PBR + measure preset
//              (render/graph/presets.ts) through compileGraph (render/graph/compile.ts, loaded by loadGraphCompiler)
//   family-roles / graph-roles  0.8 m boxes whose UV0 carries measure roles (sides structure, tops trim; under 1 m, so
//              unlabelled): the role decode, the face grid and the role colours, family vs the graph preset
//   family-labels / graph-labels  2 m boxes whose UV0 carries roles AND labelled sizes ("2.5×1.5" in front, "10.5×12" on the
//              sides, "2×2" on top): the size-label glyphs, family vs the graph preset (SF59 step 4)
//   family-emit / graph-emit  the boxes as the emissive family's opaque surface (HDR intensity, a flicker seed on the
//              look's clock at 0) vs the emissive preset
//   family-tube / graph-tube  the boxes as the emissive family's neon tube (opaque blend) over a procedural ring field
//              (core, rim, seam, halo, a cell fade) vs the emissive preset
//   family-sf / graph-sf  the boxes from an admitted fixture shardfile through the client's path (clientMaterials, graphs
//              on, SF59 step 5): a PBR family entry vs a graph entry bound to a day key (sun.colour) and declared state
//   family-toon / graph-toon  the boxes as the toon family (its light model: bands, terminator, rim, cloud shade) vs the toon
//              preset through the lighting stage (SF59 step 6)
//   family-paint / graph-paint  the boxes as the painterly family (cel bands, painted shade, warm terminator, rim, floor,
//              the per-pixel grade) vs the painterly preset through the lighting stage
//   graph-pastel / graph-ink  G169's stress cases (stress.js): the pastel alien plain and the ink / cel valley as graphs
//              (no family to compare: they must admit, compile and render clean at the floor; their ops are recorded);
//              the ink valley draws real outlines through the outline stage (an inverted hull, SF59 step 7)
//   family-toonwater / graph-toonwater  as the toon pair under a water level at 3 m (strength 3, so the metric sees them): the caustics (SF59 step 7)
//   family-paintsway / graph-paintsway  as the painterly pair with the wind sway on (sway 0.3): the vertex offset from the
//              instance origin and the geometry's height, frozen at the look's clock 0 (SF59 step 7)
// SF59 step 2: the TSL variants run the ENGINE's back-end (src/engine/render/nodes/, loaded lazily through
// render/graphBackend.ts): its output transform, its target-texture flip fix, its fog epilogue and its tent shadow filter.
// Every variant installs the engine's tent (shadowFilter.ts, 7×7 at radius 1.5), as the game's sky rig does.
// It reports compile stall, programs and shader sizes, frame times, memory and a frame for the parity diff, and POSTs the
// JSON to /result (run.mjs writes it out).
import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js';
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import {
  Fn, float, vec2, vec3, vec4, uniform, positionLocal, positionWorld, normalWorldGeometry, uv,
  fwidth, abs, fract, floor, smoothstep, max, min, mix, clamp, dot, select, sin, time, instanceIndex,
  luminance, hash, PCFShadowFilter,
} from 'three/tsl';
import { loadGraphBackend, loadGraphCompiler } from '@wildshard/engine/render/graphBackend';
import { emissiveGraph, painterlyGraph, pbrMeasureGraph, PRESET_GRAPH_BUDGET, toonGraph } from '@wildshard/engine/render/graph/presets';
import { compileToon, ToonLook } from '@wildshard/engine/render/families/toon';
import { compilePainterly, PainterlyLook } from '@wildshard/engine/render/families/painterly';
import { inkGraph, opsOf, pastelGraph } from './stress.js';
import { targetTexture } from '@wildshard/engine/render/nodes/engineNodesHandler';
import { installFrameCounter, renderCount } from '@wildshard/engine/render/frameCounter';
import { installShadowFilter } from '@wildshard/engine/world/shadowFilter';
import { compilePbr } from '@wildshard/engine/render/families/pbr';
import { compileEmissive, EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { parseFamilyMaterial, measureUv } from '@wildshard/engine/render/families/params';
import { installAtmosphere, fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { patchShader, PATCH_ORDER, takeForeignHook } from '@wildshard/engine/render/shaderPatches';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { patchCSMShaderChunk } from '@wildshard/engine/world/csmLightBlock';
import { ShadowFade, installShadowFadeChunk, sunFadeUniform } from '@wildshard/engine/world/shadowFade';
import { registerCascades } from '@wildshard/engine/world/cascadeLights';
import { Scope } from '@wildshard/engine/app/scope';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/game/shardfile/schema';
import { clientMaterials } from '../../src/game/shardfile/clientMaterials';
import { materialGraphRules } from '../../src/game/shardfile/materials';

const VARIANT = location.hash.slice(1) || 'family';
// the Simulator's Safari can run the module before it lays the page out (innerWidth 0, so a 0 × 0 target): wait for it
while (window.innerWidth === 0 || window.innerHeight === 0) await new Promise((resolve) => { requestAnimationFrame(() => { resolve(undefined); }); });
const FRAMES = 240;
const GRID = 50; // 2,500 instances: past every device's uniform-buffer limit, so TSL takes the instanced-attribute path
const tsl = !VARIANT.startsWith('family') && VARIANT !== 'warmup' && VARIANT !== 'plain'; // warmup: a discarded family page that warms the shared programs
// a per-page constant in the program that differs between variants (the boxes, and the TSL post graph), so the stall
// always measures that program compiled cold: WebKit and Metal cache programs by source, across Safari launches and
// Simulator boots, and the shared programs (ground, shadow depth, GLSL post) are warmed by run.mjs's warmup page
const NONCE = ((1 + Math.floor(Math.random() * 999999)) * 1e-12).toExponential(6);

// ── the renderer, as Game.ts sets it up ──
const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2); // render scale 2× (AGENTS.md)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the screen pass
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = installShadowFilter(); // the engine's tent (E138), before anything compiles, as skyRig.ts does
installFrameCounter(renderer); // the engine's render count (createRenderer does it in the game)
document.body.append(renderer.domElement);
const gl = renderer.getContext();

/** tsl-raw: three's stock handler (no output fix, three's own fog and PCF), timed like the engine's */
class StockNodesHandler extends WebGLNodesHandler {
  constructor() { super(); this.buildMs = 0; this.builds = 0; }
  build(material, object, parameters) { const t0 = performance.now(); super.build(material, object, parameters); this.buildMs += performance.now() - t0; this.builds++; }
}
let handler = null;
if (VARIANT === 'tsl-raw') { handler = new StockNodesHandler(); renderer.setNodesHandler(handler); }
else if (tsl) handler = await loadGraphBackend(renderer); // the engine's back-end, as its own lazy chunk
const GRAPH = VARIANT.startsWith('graph');
const ROLES = VARIANT.endsWith('-roles');
const LABELS = VARIANT.endsWith('-labels');
const EMIT = VARIANT.endsWith('-emit') || VARIANT.endsWith('-tube');
const SHARDFILE = VARIANT.endsWith('-sf');
const WATER = VARIANT.endsWith('-toonwater'), SWAY = VARIANT.endsWith('-paintsway');
const TOON = VARIANT.endsWith('-toon') || WATER, PAINT = VARIANT.endsWith('-paint') || SWAY, STRESS = VARIANT === 'graph-pastel' || VARIANT === 'graph-ink';
const compiler = GRAPH && !SHARDFILE ? await loadGraphCompiler(renderer) : null; // the graph compiler, the same lazy door

// ── the scene ──
installAtmosphere(); // the engine's fog chunks (slot 100), as Game.buildSky installs them
fogUniforms.fogHeight.value = 2;
fogUniforms.fogHeightFalloff.value = 0.15;
fogUniforms.fogHeightDensity.value = 0.02;
fogUniforms.fogDistDensity.value = 0.004;
fogUniforms.fogSunDir.value.set(-0.5, 0.35, -0.8).normalize();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.55, 0.62, 0.72);
scene.fog = new THREE.Fog(new THREE.Color(0.55, 0.62, 0.72), 1, 1000); // USE_FOG on; the engine chunk ignores near / far
const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
sun.position.set(-30, 40, -20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
sun.shadow.radius = 1.5; // the 7×7 tent (SOFT_RADII near cascade)
if (VARIANT === 'tsl-pcf') sun.shadow.filterNode = PCFShadowFilter; // the diagnostic: three's 5-tap PCF on node materials
const CASCADES = VARIANT.endsWith('-csm') || VARIANT.endsWith('-fade'); // the sky rig's sun: CSM + the E147 fade
if (!CASCADES) scene.add(sun);
scene.add(new THREE.HemisphereLight(0xa8c4ff, 0x6b5a48, 0.9));
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 9, 34);
camera.lookAt(0, 0, -6);
camera.updateMatrixWorld();
/** family-csm / tsl-csm, family-fade / tsl-fade: the sun as the sky rig builds it (skyRig.ts): three cascades with
 *  CSM's fade, the CSM light block, the E147 fade ghosts, registered for the node back-end (cascadeLightNode.ts); the
 *  -fade pair freezes a sun step half way (uSunFade 0.5), so every cascade but the last mixes its ghost's shadow */
let csm = null, fade = null;
if (CASCADES) {
  csm = new CSM({ camera, parent: scene, cascades: 3, mode: 'practical', maxFar: 120, shadowMapSize: 2048, lightDirection: new THREE.Vector3(30, -40, 20).normalize(), lightIntensity: 2.6, shadowBias: -0.0005, lightMargin: 60, lightNear: 1, lightFar: 300 });
  // after the CSM, which installs its own lights_fragment_begin (the sky rig's order)
  patchCSMShaderChunk();
  installShadowFadeChunk();
  csm.fade = true;
  for (const l of csm.lights) { l.color.set(0xfff2e0); l.shadow.radius = 1.5; }
  fade = new ShadowFade(csm, camera, scene);
  registerCascades({ csm, ghosts: fade.ghosts, fade: sunFadeUniform });
  csm.update();
  fade.warm();
  if (VARIANT.endsWith('-fade')) {
    csm.lightDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), 3 * Math.PI / 180);
    csm.update();
    fade.update(0.5); // a step starts the fade; half a second in, uSunFade = 0.5 and the ghosts hold the old direction
  }
}
/** a classic material lit by the cascades, as SkyRig.setupMaterial wires it */
function csmMaterial(mat) {
  if (csm === null || fade === null) return mat;
  const hook = takeForeignHook(mat, () => { csm.setupMaterial(mat); });
  mat.defines = { ...mat.defines, CSM_GHOSTS: fade.ghosts.length };
  patchShader(mat, 'engine.csm', PATCH_ORDER.shadows, (shader, r) => { hook(shader, r); shader.uniforms.uSunFade = sunFadeUniform; }, { key: (k) => `${k}|csm` });
  mat.needsUpdate = true;
  return mat;
}

// the PBR family with SF56's measure layer, through the engine's own compiler (the hand-written family)
const params = parseFamilyMaterial({ family: 'pbr', colour: [0.8, 0.8, 0.8], roughness: 0.85, metalness: 0, measure: {} });
if (params.family !== 'pbr' || params.measure === null) throw new Error('spike: a PBR measure surface');
const measure = params.measure;
const familyMat = () => compilePbr(params, () => { throw new Error('spike: no textures'); });

// the emissive family (step 4): a surface, or a tube over a procedural ring field (R fill, 0.5 on the edge; G skeleton)
const FIELD = (() => {
  const n = 128, data = new Uint8Array(n * n * 4), fillSpread = 0.3, skeletonSpread = 0.4;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n - 0.5, v = (y + 0.5) / n - 0.5, sk = Math.abs(Math.hypot(u, v) - 0.3);
    const dFill = 0.07 - sk, k = (y * n + x) * 4;
    data[k] = Math.round(Math.min(1, Math.max(0, 0.5 + dFill / (2 * fillSpread))) * 255);
    data[k + 1] = Math.round(Math.min(1, sk / skeletonSpread) * 255);
    data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const emitEntry = VARIANT.endsWith('-tube')
  ? { family: 'emissive', colour: [0.3, 0.9, 1], intensity: 2.5, tube: { field: 'ring', fillSpread: 0.3, skeletonSpread: 0.4, seam: 0.4, cell: [0.5, 0.5] } }
  : { family: 'emissive', colour: [1, 0.55, 0.2], intensity: 1.6, flicker: 3 };
const emitParams = parseFamilyMaterial(emitEntry);
if (emitParams.family !== 'emissive') throw new Error('spike: an emissive surface');
const emitLook = new EmissiveLook({ gain: 1.25 });
const emitTextures = () => FIELD;

// the toon and painterly families (step 6): plain colour, no vertex colours (the boxes carry none), the looks' defaults
const toonParams = parseFamilyMaterial({ family: 'toon', colour: [0.85, 0.62, 0.42], vertexColours: false });
const paintParams = parseFamilyMaterial({ family: 'painterly', colour: [0.55, 0.72, 0.36], vertexColours: false, ...(SWAY ? { sway: 0.3 } : {}) });
if (toonParams.family !== 'toon' || paintParams.family !== 'painterly') throw new Error('spike: toon / painterly surfaces');
const toonLook = new ToonLook(WATER ? { caustics: { level: 3, strength: 3 } } : {});
const paintLook = new PainterlyLook({});
let graphReadout = null; // graph variants: the compiled graph's cost and ops
/** @type {import('three/webgpu').NodeMaterial | null} */
let graphOutline = null; // a graph with an outline stage: its second draw's material (attached to the boxes below)

const lin = (rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
/** the measure layer's grid (measure.ts famMGrid), as TSL */
const grid = Fn(([c, pitch, hw]) => {
  const fw = max(fwidth(c), vec2(1e-5));
  const d = abs(fract(c.div(pitch).add(0.5)).sub(0.5)).mul(pitch);
  const w = max(vec2(hw), fw.mul(0.75));
  const l = float(1).sub(smoothstep(w.sub(fw.mul(0.5)), w.add(fw.mul(0.5)), d)).mul(min(vec2(1), vec2(hw).div(w).mul(1.6))).toVar();
  l.mulAssign(float(1).sub(smoothstep(pitch.mul(0.12), pitch.mul(0.35), fw)));
  return max(l.x, l.y);
});
/** the PBR family + measure layer re-expressed as a TSL node material (the graph a compiler would emit) */
function tslMat(sway) {
  const m = new MeshStandardNodeMaterial({ color: lin(params.colour), roughness: params.roughness, metalness: params.metalness });
  m.name = 'tsl:pbr-measure';
  m.fog = true; // the engine back-end's epilogue fogs it (engineFog.ts) after the output transform
  const on = uniform(1);
  const lineC = uniform(lin(measure.line.colour)), labelUnused = lin(measure.label.colour);
  void labelUnused; // the size-label glyphs are not ported in the spike (see the verdict)
  const muv = uv();
  const code = floor(muv.x.div(64));
  const role = code.sub(floor(code.div(4)).mul(4));
  const na = abs(normalWorldGeometry);
  const world = select(na.y.greaterThanEqual(max(na.x, na.z)), positionWorld.xz, select(na.x.greaterThanEqual(na.z), positionWorld.zy, positionWorld.xy));
  const face = vec2(muv.x.sub(code.mul(64)), muv.y.sub(floor(muv.y.div(64)).mul(64))).sub(1);
  const hasRole = role.equal(1).or(role.equal(2));
  const c = select(hasRole, face, world);
  const main = grid(c, float(1), float(measure.line.width));
  const fine = grid(c, float(measure.sub.step), float(measure.line.width * 0.6));
  const base = select(role.equal(1), uniform(lin(measure.structure)), select(role.equal(2), uniform(lin(measure.trim)), uniform(lin(measure.floor))));
  const lineA = select(hasRole, float(measure.line.alpha), float(measure.line.floorAlpha));
  const out = mix(mix(base, lineC, fine.mul(measure.sub.alpha)), lineC, main.mul(lineA));
  m.colorNode = mix(vec3(lin(params.colour)), out, on);
  m.emissiveNode = out.mul(measure.lift).mul(on).add(float(Number(NONCE)));
  if (sway) {
    const phase = hash(instanceIndex).mul(6.283);
    m.positionNode = positionLocal.add(vec3(sin(time.mul(1.7).add(phase)).mul(positionLocal.y.add(1).mul(0.12)), 0, 0));
  }
  return m;
}

// ground (always the family: patched and node materials in one frame) and the instanced boxes
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), csmMaterial(familyMat()));
ground.receiveShadow = true;
scene.add(ground);
const BOX = ROLES ? 0.8 : LABELS ? 2 : 1.6;
const boxGeo = new THREE.BoxGeometry(BOX, 1, BOX, 1, 1, 1).translate(0, 0.5, 0);
if (ROLES) {
  // BoxGeometry's faces are +x, −x, +y, −y, +z, −z, four vertices each: sides are structure (role 1), top and bottom trim
  const uvs = boxGeo.getAttribute('uv');
  for (let i = 0; i < uvs.count; i++) {
    const face = Math.floor(i / 4), top = face === 2 || face === 3;
    const w = BOX, h = top ? BOX : 1;
    const [x, y] = measureUv(top ? 2 : 1, uvs.getX(i) * w, uvs.getY(i) * h, w, h);
    uvs.setXY(i, x, y);
  }
  uvs.needsUpdate = true;
}
if (LABELS) {
  // faces +x, −x, +y, −y, +z, −z: sides structure, top and bottom trim; the declared sizes are labelled (whole or half metres)
  const sizes = [[10.5, 12], [10.5, 12], [2, 2], [2, 2], [2.5, 1.5], [1.5, 1.5]];
  const uvs = boxGeo.getAttribute('uv');
  for (let i = 0; i < uvs.count; i++) {
    const face = Math.floor(i / 4), [w, h] = sizes[face];
    const [x, y] = measureUv(face === 2 || face === 3 ? 2 : 1, uvs.getX(i) * w, uvs.getY(i) * h, w, h);
    uvs.setXY(i, x, y);
  }
  uvs.needsUpdate = true;
}
/** graph / graph-roles: the boxes from the compiler (the preset IR plus the page's cold-compile constant on the glow) */
function graphMat() {
  if (TOON || PAINT || STRESS) {
    const ir = VARIANT === 'graph-pastel' ? pastelGraph(Number(NONCE)) : VARIANT === 'graph-ink' ? inkGraph(Number(NONCE)) : TOON ? toonGraph(toonParams, toonLook.params) : painterlyGraph(paintParams, paintLook.params);
    const withNonce = STRESS ? ir : { ...ir, nodes: { ...ir.nodes, nonceE: { op: 'const', value: Number(NONCE) } }, stages: { ...ir.stages, surface: { ...ir.stages.surface, emissive: 'nonceE' } } };
    const g = compiler.compileGraph(withNonce, { budget: PRESET_GRAPH_BUDGET });
    graphReadout = { cost: g.cost, selects: g.selects, ops: opsOf(ir), outline: g.outline !== null };
    graphOutline = g.outline;
    return g.material;
  }
  if (EMIT) {
    const ir = emissiveGraph(emitParams, emitLook.params);
    const g = compiler.compileGraph({ ...ir, nodes: { ...ir.nodes, outN: { op: 'add', in: ['out', Number(NONCE)] } }, stages: { surface: { colour: 'outN' } } }, { budget: PRESET_GRAPH_BUDGET, textures: emitTextures });
    return g.material;
  }
  const ir = pbrMeasureGraph(params, measure);
  const g = compiler.compileGraph({ ...ir, nodes: { ...ir.nodes, glowN: { op: 'add', in: ['glow', Number(NONCE)] } }, stages: { surface: { ...ir.stages.surface, emissive: 'glowN' } } }, { budget: PRESET_GRAPH_BUDGET });
  return g.material;
}
/** the diagnostic pair plain / tsl-plain: the stock standard material, classic vs node, no measure layer (the cost of
 * TSL's own lighting and shadow path, apart from the graph the spike ported) */
function plainMat() {
  const opts = { color: lin(params.colour), roughness: params.roughness, metalness: params.metalness };
  if (!tsl) return new THREE.MeshStandardMaterial(opts);
  const m = new MeshStandardNodeMaterial(opts);
  m.emissiveNode = vec3(float(Number(NONCE)));
  return m;
}
let shardfileReadout = null; // family-sf / graph-sf: what clientMaterials made of the fixture
/**
 * family-sf / graph-sf (SF59 step 5): the boxes from an ADMITTED shardfile through the client's own path
 * (parseShardfile → clientMaterials, graphs on): a PBR family entry vs a graph entry whose tint is bound to the look's
 * `sun.colour` day key and whose roughness is bound to the public shared state `wet` (its declared default 0.8)
 */
async function shardfileMat() {
  const keySun = [0.85, 0.6, 0.35]; // a key colour, stored linear
  const srgb = new THREE.Color(keySun[0], keySun[1], keySun[2]).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const base = emptyShardfile({ slug: 'graph-fixture', name: 'Graph fixture', author: 'Local', seed: 1, revision: 1 });
  base.state.shared.push({ id: 1, name: 'wet', type: 'f64', privacy: 'public', default: 0.8 });
  const key = { time: 0.5, sky: { zenith: [0.1, 0.2, 0.4], horizon: [0.6, 0.7, 0.8] }, fog: { colour: [0.5, 0.5, 0.5], density: 0.004 }, sun: { colour: keySun, intensity: 2.6 }, ambient: { sky: [1, 1, 1], ground: [0, 0, 0], intensity: 0.9 } };
  const box = VARIANT === 'graph-sf'
    ? { family: 'graph', graph: { version: 1, kind: 'material', model: 'standard',
      params: { tint: { type: 'colour', value: [1, 1, 1], bind: { day: 'sun.colour' } }, wet: { type: 'float', value: 0, min: 0, max: 1, bind: { state: 'shared.wet' } } },
      nodes: { tint: { op: 'param', param: 'tint' }, wet: { op: 'param', param: 'wet' } }, stages: { surface: { colour: 'tint', roughness: 'wet', metalness: 0 } } } }
    : { family: 'pbr', colour: [srgb.r, srgb.g, srgb.b], roughness: 0.8, metalness: 0 };
  const shard = parseShardfile({ ...base, look: { ...base.look, keys: [key], dayOverride: 0.5, materials: { box } } });
  const rules = materialGraphRules(shard);
  if (rules.length > 0) throw new Error(`spike: fixture refused: ${rules.join('; ')}`);
  const look = await clientMaterials(shard, new Map(), renderer, new Scope('sf59.fixture'), { graphs: true });
  const material = look.materials.get('box');
  if (material === undefined) throw new Error('spike: no fixture material');
  shardfileReadout = { ...look.graphs.readout, material: material.type };
  return material;
}
const familyStyled = () => (TOON ? compileToon(toonParams, toonLook) : compilePainterly(paintParams, paintLook, () => { throw new Error('spike: no textures'); }));
const boxMat = SHARDFILE ? await shardfileMat() : !tsl && (TOON || PAINT) ? familyStyled() : VARIANT === 'plain' || VARIANT === 'tsl-plain' ? plainMat() : GRAPH ? graphMat() : tsl ? tslMat(VARIANT === 'tsl-sway') : EMIT ? compileEmissive(emitParams, emitLook, emitTextures) : familyMat();
if (!tsl && VARIANT !== 'warmup') {
  patchShader(boxMat, 'spike.nonce', PATCH_ORDER.decorate, (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(/\}\s*$/, `  gl_FragColor.rgb += vec3( ${NONCE} );\n}`);
  });
  csmMaterial(boxMat);
}
// the handler writes instancing attributes into the geometry, so a TSL InstancedMesh needs a geometry of its own; a
// shallow clone (the same attribute objects, so the same GPU buffers) is enough
const ownGeo = new THREE.BufferGeometry();
for (const [k, a] of Object.entries(boxGeo.attributes)) ownGeo.setAttribute(k, a);
ownGeo.setIndex(boxGeo.index);
const boxes = new THREE.InstancedMesh(tsl ? ownGeo : boxGeo, boxMat, GRID * GRID);
const mtx = new THREE.Matrix4();
for (let i = 0; i < GRID * GRID; i++) {
  const x = (i % GRID) - GRID / 2, z = Math.floor(i / GRID) - GRID / 2;
  const h = 0.5 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3.5;
  mtx.makeScale(1, h, 1).setPosition(x * 2.4, 0, z * 2.4);
  boxes.setMatrixAt(i, mtx);
}
boxes.castShadow = true;
boxes.receiveShadow = true;
scene.add(boxes);
if (graphOutline instanceof MeshBasicNodeMaterial) compiler.attachOutline(boxes, graphOutline); // the outline stage's second draw

// ── the screen pass: the engine's half-float target, then a grade + filmic + vignette to the screen ──
const W = Math.floor(window.innerWidth * 2), H = Math.floor(window.innerHeight * 2);
const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true });
const post = { exposure: 1.1, saturation: 1.15, lift: [0.02, 0.01, 0.03], gain: [1.02, 1.0, 0.96], vignette: 0.35 };
const GLSL_POST = /* glsl */`
uniform sampler2D tSrc; uniform float uExposure, uSaturation, uVignette; uniform vec3 uLift, uGain; varying vec2 vUv;
vec3 aces( vec3 x ) { return clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 ); }
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb * uExposure;
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, uSaturation );
  c = c * uGain + uLift;
  c = aces( c );
  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * smoothstep( 0.2, 0.8, dot( d, d ) * 2.0 );
  gl_FragColor = linearToOutputTexel( vec4( c, 1.0 ) );
}`;
function glslPost() {
  return new THREE.ShaderMaterial({
    name: 'glsl:post',
    uniforms: { tSrc: { value: target.texture }, uExposure: { value: post.exposure }, uSaturation: { value: post.saturation }, uVignette: { value: post.vignette }, uLift: { value: new THREE.Vector3(...post.lift) }, uGain: { value: new THREE.Vector3(...post.gain) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: GLSL_POST, depthTest: false, depthWrite: false,
  });
}
/** the same screen pass as a TSL node graph on a fullscreen quad (the WebGPU PostProcessing stack is not available here) */
function tslPost() {
  const m = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false });
  m.name = 'tsl:post';
  m.fog = false;
  const q = uv();
  // the engine's targetTexture() samples the classic renderer's target upright (the spike cancelled three's flip by hand)
  let c = targetTexture(target.texture, q).rgb.mul(uniform(post.exposure));
  c = mix(vec3(luminance(c)), c, uniform(post.saturation));
  c = c.mul(uniform(new THREE.Vector3(...post.gain))).add(uniform(new THREE.Vector3(...post.lift)));
  c = clamp(c.mul(c.mul(2.51).add(0.03)).div(c.mul(c.mul(2.43).add(0.59)).add(0.14)), 0, 1);
  const d = q.sub(0.5);
  c = c.mul(float(1).sub(uniform(post.vignette).mul(smoothstep(0.2, 0.8, dot(d, d).mul(2)))));
  m.colorNode = c.add(float(Number(NONCE)));
  m.vertexNode = vec4(positionLocal.xy, 0, 1);
  return m;
}
const postScene = new THREE.Scene();
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), VARIANT === 'tsl-post' || VARIANT === 'tsl-sway' ? tslPost() : glslPost());
quad.frustumCulled = false;
postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function frame() {
  if (csm !== null) csm.update();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

// ── measurement ──
const programs = () => renderer.info.programs ?? [];
function shaderSizes() {
  return programs().map((p) => {
    const shaders = gl.getAttachedShaders(p.program) ?? [];
    const src = shaders.map((s) => ({ type: gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.VERTEX_SHADER ? 'vs' : 'fs', bytes: (gl.getShaderSource(s) ?? '').length }));
    return { name: p.name, vs: src.find((s) => s.type === 'vs')?.bytes ?? 0, fs: src.find((s) => s.type === 'fs')?.bytes ?? 0 };
  });
}
const pixel = new Uint8Array(4);
const sync = () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); };
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const heap = () => performance.memory?.usedJSHeapSize ?? null;

async function run() {
  const errors = [];
  const heap0 = heap();
  // compile stall: program creation (incl. the node build) then the first draw, forced to finish with a 1-pixel read
  const t0 = performance.now();
  renderer.setRenderTarget(target);
  renderer.compile(scene, camera);
  renderer.setRenderTarget(null);
  renderer.compile(postScene, postCam);
  const tCompile = performance.now() - t0;
  const t1 = performance.now();
  frame();
  sync();
  const tFirst = performance.now() - t1;
  const programsAfterFirst = programs().length;
  // a few warm frames, then the timed run (rAF cadence like scripts/frame-floor.mjs, plus the CPU cost of the frame)
  for (let i = 0; i < 20; i++) await new Promise((resolve) => { requestAnimationFrame(() => { frame(); resolve(undefined); }); });
  const raf = [], work = [];
  let last = 0;
  await new Promise((resolve) => {
    const step = (now) => {
      if (last > 0) raf.push(now - last);
      last = now;
      const w0 = performance.now();
      frame();
      work.push(performance.now() - w0);
      if (raf.length < FRAMES) requestAnimationFrame(step); else resolve(undefined);
    };
    requestAnimationFrame(step);
  });
  const stat = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; return { median: round(q(0.5), 2), p95: round(q(0.95), 2), max: round(s[s.length - 1] ?? 0, 2) }; };
  const rafStat = stat(raf);
  // the GPU cost of a frame: rAF is vsync-capped wherever the frame fits, so it cannot tell a 5 % difference; a frame
  // followed by a 1-pixel read waits for the GPU to finish it (the frame's wall time, CPU submit + GPU). Timed in batches
  // of 10 synced frames, because Safari's performance.now() has 1 ms resolution
  const synced = [];
  for (let b = 0; b < 30; b++) {
    const s0 = performance.now();
    for (let i = 0; i < 10; i++) { frame(); sync(); }
    synced.push((performance.now() - s0) / 10);
  }
  // a fixed-time parity frame (the sway variant at t = 0 is still the static layout)
  frame();
  const shot = renderer.domElement.toDataURL('image/png');
  const err = gl.getError();
  if (err !== gl.NO_ERROR) errors.push(`gl error ${err}`);
  return {
    variant: VARIANT, ua: navigator.userAgent, shardfile: shardfileReadout, graph: graphReadout, size: [W, H], instances: GRID * GRID,
    uniformBlockLimit: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
    compileMs: round(tCompile, 1), firstDrawMs: round(tFirst, 1), stallMs: round(tCompile + tFirst, 1),
    nodeBuildMs: handler ? round(handler.buildMs, 1) : 0, nodeBuilds: handler ? handler.builds : 0,
    programs: programsAfterFirst, programsAtEnd: programs().length, shaders: shaderSizes(),
    rafMs: rafStat, fps: round(1000 / rafStat.median, 1), workMs: stat(work), syncedMs: stat(synced),
    // the engine's render count vs three's: node draws bump three's once per draw (§2.3), the engine's once per render
    engineRenders: renderCount(renderer), threeFrame: renderer.info.render.frame,
    calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, memory: { ...renderer.info.memory },
    heapMB: heap0 === null ? null : round((heap() ?? 0) / 1048576, 1), heapAtStartMB: heap0 === null ? null : round(heap0 / 1048576, 1),
    errors, shot,
  };
}

const origError = console.error.bind(console);
const consoleErrors = [];
console.error = (...a) => { consoleErrors.push(a.map(String).join(' ').slice(0, 400)); origError(...a); };
window.addEventListener('error', (e) => { consoleErrors.push(e.message.slice(0, 400)); });
async function report() {
  let result;
  try {
    result = await run();
    result.errors.push(...consoleErrors);
  } catch (e) {
    result = { variant: VARIANT, failed: String(e instanceof Error ? e.stack : e).slice(0, 2000), errors: consoleErrors };
  }
  window.tslSpikeResult = result;
  try { await fetch('/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(result) }); } catch { /* desktop reads window.tslSpikeResult */ }
}
void report();
