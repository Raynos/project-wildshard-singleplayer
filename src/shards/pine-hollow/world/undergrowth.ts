import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { bakedUndergrowth } from '@wildshard/engine/world/BakedTerrain';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { DecisionLog, placeUndergrowth, placementChecksum, sameChecksum, type Placement, type UnderPlacements } from '@wildshard/engine/world/forest/placement';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { patchWindField } from '@wildshard/engine/world/wind';
import { UNDER_SHAPES, type UnderShape } from './undergrowthKit';

/**
 * Forest-floor undergrowth: ferns, low round-leaf shrubs and needle/twig litter — the field (world): where every copy
 * goes, each kind's geometry, texture and material. Each kind is a model (src/shards/pine-hollow/models/fern.ts …) that
 * `place` draws instanced into `group` and culls per 32 m cell round the forest's view (E315: `kinds`, `matrixOf`,
 * `UNDER_CELLS`; src/shards/pine-hollow/world/drawnModels.ts).
 *
 *   const under = new Undergrowth(sky, forest).build();
 *   scene.add(under.group);
 *   game.onUpdate((dt) => under.update(dt, player.position));   // only feeds the viewer position uniform
 *
 * Everything is placed once, deterministically (Rng), chunk-wide:
 *  - ~6000 ferns (9 arched frond quads in a rosette, procedural pinnate-leaf alpha texture) in
 *    shaded forest floor, along trail verges (5.5–10 m from the centreline) and around the pond:
 *    not on rock / cabin pads / inside trunks / in the water. Cast + receive shadows.
 *  - ~1500 shrubs (4 crossed quads, round-leaf texture) at floor/grass edges.
 *  - ~5000 twig/needle-litter quads and ~3000 dark pebble clusters lying flat under the trees.
 *  - ~3000 moss patches (flat, soft mottled alpha) hugging the base of trunks.
 *  - ~1500 reed / sedge clumps (tall thin blades, 0.8–1.2 m) on the pond shore and in the shallows.
 * Six draw calls (+ fern & shrub shadow passes). Instances scale to 0 beyond `fadeFar` metres
 * in the vertex shader so distant ones cost nothing in the fragment stage.
 *
 * Public: `group` (the kinds' placed meshes go in it), `kinds` (each kind's parts), `layout`, `counts`, `view`.
 */

const FADE_FAR = TIER_CONFIG.undergrowthFar, FADE_BAND = Math.min(25, FADE_FAR * 0.3);
/** how `place` culls the field's copies (the old CelledInstances: 32 m cells, a copy reaches 2.5 m, gone 2 m past the fade) */
export const UNDER_CELLS = { size: 32, pad: 2.5, far: FADE_FAR + 2 } as const;

/** one kind as the field draws it: its geometry, its material (and its shadow's) — a model's parts (E315) */
export interface UnderKindDraw {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly castShadow: boolean;
  readonly customDepthMaterial?: THREE.Material;
}
export type UnderKind = keyof UnderPlacements;

const underUniforms = {
  uFadeFar: { value: FADE_FAR },
  uFadeBand: { value: FADE_BAND },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 0.93, 0.8) },
  uViewerPos: { value: new THREE.Vector3() },   // the player's camera (shadow passes see the light's cameraPosition)
};

const UP = new THREE.Vector3(0, 1, 0);

export class Undergrowth {
  group = new THREE.Group();
  /** each kind's parts (the field's shader material): its model draws them (E315) */
  kinds!: Readonly<Record<UnderKind, UnderKindDraw>>;
  counts = { ferns: 0, shrubs: 0, litter: 0, stones: 0, moss: 0, reeds: 0 };
  /** where every copy of every kind stands (E315 M2: each kind is a model the field draws; its card counts these) */
  layout: UnderPlacements = { ferns: [], shrubs: [], litter: [], stones: [], moss: [], reeds: [] };

  constructor(private sky: Sky, private forest: Forest) {}

  /** the view the copies are culled from: the forest's padded frustum, refilled when it moves or turns */
  get view(): Forest { return this.forest; }

  build(): this {
    const g = this.stages();
    while (g.next().done !== true) { /* every stage in one go */ }
    return this;
  }

  /**
   * `build()` with the event loop let in between its stages (`pause`, e.g. a macrotask): the textures, then
   * each kind's placement pass. Same rolls, same placements; in one call it was a ~290 ms task at 4x CPU.
   */
  async buildAsync(pause: () => Promise<void>): Promise<this> {
    const g = this.stages();
    while (g.next().done !== true) await pause();
    return this;
  }

  private *stages(): Generator<void, void, undefined> {
    // the sky's own objects (not copies): the day / night clock moves the sun by mutating them in place
    underUniforms.uSunDir.value = this.sky.sunDir;
    underUniforms.uSunColor.value = this.sky.sunColor;
    const fernTex = makeFernTexture(), shrubTex = makeShrubTexture(), litterTex = makeLitterTexture();
    const fernMat = this.makeMaterial(fernTex, 'fern', 0.35, 0.5);
    const shrubMat = this.makeMaterial(shrubTex, 'shrub', 0.25, 0.5);
    const litterMat = this.makeMaterial(litterTex, 'litter', 0.0, 0.35);
    litterMat.roughness = 1;
    const stoneTex = makeStoneTexture(), mossTex = makeMossTexture(), reedTex = makeReedTexture();
    const stoneMat = this.makeMaterial(stoneTex, 'stone', 0.0, 0.5);
    stoneMat.roughness = 0.75;
    const mossMat = this.makeMaterial(mossTex, 'moss', 0.0, 0.4);
    mossMat.roughness = 1;
    // flat ground layers: pull towards the camera so the terrain mesh (±5 cm off heightAt) never swallows them
    for (const m of [litterMat, stoneMat, mossMat]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
    const reedMat = this.makeMaterial(reedTex, 'reed', 0.5, 0.45);
    yield;

    const place = yield* this.placements();
    this.layout = place;
    this.kinds = {
      ferns: kindDraw(toGeometry(UNDER_SHAPES.ferns), fernMat, true, fernTex, 0.35),
      shrubs: kindDraw(toGeometry(UNDER_SHAPES.shrubs), shrubMat, true, shrubTex, 0.25),
      litter: kindDraw(toGeometry(UNDER_SHAPES.litter), litterMat, false),
      stones: kindDraw(toGeometry(UNDER_SHAPES.stones), stoneMat, false),
      moss: kindDraw(toGeometry(UNDER_SHAPES.moss), mossMat, false),
      reeds: kindDraw(toGeometry(UNDER_SHAPES.reeds), reedMat, true, reedTex, 0.5),
    };
    this.counts = { ferns: place.ferns.length, shrubs: place.shrubs.length, litter: place.litter.length, stones: place.stones.length, moss: place.moss.length, reeds: place.reeds.length };
  }

  /**
   * Where everything goes (src/engine/world/forest/placement.ts): the build's decision log replayed when the chunk's
   * terrain.bin carries one that fits this build — no candidate tested at launch — else the tests run.
   */
  private *placements(): Generator<void, UnderPlacements, undefined> {
    const baked = bakedUndergrowth();
    if (baked) {
      try {
        const p = yield* placeUndergrowth(this.forest.trees, this.forest, DecisionLog.replay(baked.bits, baked.length));
        if (sameChecksum(placementChecksum(p), baked.checksum)) return p;
        console.warn('[baked] undergrowth decision log does not fit this build; placing at launch');
      } catch (e) { console.warn(`[baked] undergrowth decision log not used (${(e as Error).message}); placing at launch`); }
    }
    return yield* placeUndergrowth(this.forest.trees, this.forest, DecisionLog.record());
  }

  /** `playerPos` in the floor's own frame; the fade compares world positions, so it goes out through the group's world matrix (a grid region's offset, G223; identity standalone) */
  update(_dt: number, playerPos: THREE.Vector3): void { underUniforms.uViewerPos.value.copy(playerPos).applyMatrix4(this.group.matrixWorld); }

  private makeMaterial(tex: THREE.Texture, key: string, wind: number, alphaTest: number) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    mat.name = `under-${key}`;
    patchShader(mat, 'pine.undergrowth', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, underUniforms);
      patchUndergrowthVertex(shader, wind);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', /* glsl */`#include <common>
          varying float vH;
          uniform vec3 uSunDir; uniform vec3 uSunColor;`)
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
          diffuseColor.rgb *= mix( 0.55, 1.0, smoothstep( 0.0, 0.5, vH ) );`)
        .replace('#include <alphatest_fragment>', /* glsl */`
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;`)
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
        .replace('#include <lights_fragment_begin>', /* glsl */`#include <lights_fragment_begin>
          {
            vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
            float bl = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 5.0 );
            reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.05 + bl * 0.35 ) * uSunColor;
          }`);
    }, { mode: 'replace', key: 'under' }); // `key` names the material; wind is a uniform, so every kind shares ONE program (was 6 — ~150 ms each on iOS)
    this.sky.setupMaterial(mat);
    return mat;
  }

}

/** a kind's parts: its geometry and material, and — where the tier casts its shadow — the alpha-tested shadow material */
function kindDraw(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, shadow: boolean, tex?: THREE.Texture, wind = 0): UnderKindDraw {
  const castShadow = shadow && TIER_CONFIG.undergrowthShadows;
  if (!castShadow || !tex) return { geometry, material, castShadow };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  patchShader(depth, 'pine.undergrowth-depth', PATCH_ORDER.material, (shader) => { patchUndergrowthVertex(shader, wind); }, { mode: 'replace', key: 'under-depth' }); // wind is a uniform: one depth program for every kind
  return { geometry, material, castShadow, customDepthMaterial: depth };
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();

/** a copy's transform: tilted to the ground's normal, turned about it, scaled */
export function matrixOf(it: Placement, target = new THREE.Matrix4()): THREE.Matrix4 {
  _n.set(it.nx, it.ny, it.nz);
  _q2.setFromUnitVectors(UP, _n);
  _q.setFromAxisAngle(UP, it.rot).premultiply(_q2);
  return target.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.scale, it.scale, it.scale));
}

/** Distance fade (scale to 0) + gentle wind, shared by the lit and the shadow-depth materials. */
function patchUndergrowthVertex(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, wind: number) {
  shader.uniforms['uWindScale'] = { value: wind }; // per material, not baked into the source: the program is shared
  patchWindField(shader); // the shared clock + gust front (wind.ts, PH-L6)
  shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
  shader.uniforms['uFadeFar'] = underUniforms.uFadeFar;
  shader.uniforms['uFadeBand'] = underUniforms.uFadeBand;
  shader.uniforms['uViewerPos'] = underUniforms.uViewerPos;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', /* glsl */`#include <common>
      uniform float uWindStrength; uniform float uWindScale; uniform float uFadeFar; uniform float uFadeBand; uniform vec3 uViewerPos;
      varying float vH;`)
    .replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
      {
        mat3 im = mat3( instanceMatrix );
        vec3 ipos = ( modelMatrix * vec4( instanceMatrix[3].xyz, 1.0 ) ).xyz;
        float dist = distance( ipos, uViewerPos );
        float fade = 1.0 - smoothstep( uFadeFar - uFadeBand, uFadeFar, dist );
        transformed *= fade;
        float h = uv.y;
        vH = h;
        float s2 = dot( im[0], im[0] );
        vec3 wpos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        vec2 dir = windDirXZ();
        float phase = dot( wpos.xz, dir ) * 0.32;
        float swell = sin( uWindTime * 1.25 - phase ) * 0.5 + 0.5;
        float gust = min( windGustAt( wpos.xz ), 1.3 ) * ( 0.35 + 0.65 * swell * swell ) * 1.25;
        float flutter = sin( uWindTime * 5.0 + wpos.x * 3.0 + wpos.z * 2.0 );
        float amp = ( 0.01 + gust * 0.05 ) * uWindStrength * uWindScale * 4.0;
        float w = h * h;
        vec3 off = vec3( dir.x * amp + flutter * 0.006, 0.0, dir.y * amp + flutter * 0.004 ) * w;
        off.y = - length( off.xz ) * 0.3;
        transformed += ( off * im ) / max( s2, 1e-6 ) * fade;
      }`);
}

// ------------------------------------------------------------------ geometry

function toGeometry({ position: verts, normal: norms, uv: uvs, index: idx }: UnderShape): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

// ------------------------------------------------------------------ textures

function canvasTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // Per-build immutable pixels; lit and depth materials share this exact texture, with no CPU readers.
  if (memorySaverOn()) gpuOnlyTexture(tex, 'undergrowth/canvas');
  return tex;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[undergrowth] no 2d canvas context');
  return g;
}

/** Pinnate fern frond: base at the bottom, tip at the top. */
function makeFernTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  g.scale(2, 2);
  const rng = new Rng(SEED + 701);
  const stemX = (t: number) => 128 + Math.sin(t * 2.2) * 6;
  const stemY = (t: number) => 512 - 6 - t * (512 - 18);
  const pairs = 19;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    // pinna length peaks around 30 % up the frond, vanishes at the tip
    const lenF = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6 * (1 - t * 0.35);
    const len = 12 + lenF * 100;
    const wid = 5 + lenF * 8;
    for (const side of [-1, 1]) {
      const bx = stemX(t), by = stemY(t) + side * 3;
      const ang = side * (0.62 - t * 0.25) + rng.range(-0.08, 0.08); // sweep upward
      drawPinna(g, bx, by, ang * side, len, wid, side, t, rng);
    }
  }
  // stem
  g.strokeStyle = 'rgb(88,96,42)'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(stemX(0), stemY(0));
  for (let i = 1; i <= 20; i++) { const t = i / 20; g.lineTo(stemX(t), stemY(t)); }
  g.stroke();
  return canvasTexture(c);
}

function drawPinna(g: CanvasRenderingContext2D, bx: number, by: number, ang: number, len: number, wid: number, side: number, t: number, rng: Rng) {
  // axis direction: outward (side) and slightly upward
  const dx = side * Math.cos(ang), dy = -Math.sin(ang) * 0.9;
  const nx = -dy, ny = dx;
  const steps = 26;
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const w = wid * Math.sin(Math.min(1, s * 1.1) * Math.PI) ** 0.55 * (1 - s * 0.15);
    const serr = (i % 2 ? 0.7 : 1.0);  // lobed pinnule edge
    const ax = bx + dx * len * s, ay = by + dy * len * s;
    left.push([ax + nx * w * serr, ay + ny * w * serr]);
    right.push([ax - nx * w * serr, ay - ny * w * serr]);
  }
  const hue = rng.range(-1, 1);
  const grad = g.createLinearGradient(bx, by, bx + dx * len, by + dy * len);
  grad.addColorStop(0, `rgb(${52 + hue * 6},${82 + hue * 8},34)`);
  grad.addColorStop(1, `rgb(${78 + hue * 10 + t * 26},${116 + hue * 10 + t * 18},${46 + hue * 6})`);
  g.fillStyle = grad;
  g.beginPath();
  left.forEach(([lx, ly], i) => { if (i === 0) g.moveTo(lx, ly); else g.lineTo(lx, ly); });
  for (let i = right.length - 1; i >= 0; i--) { const r = right[i]; if (r) g.lineTo(r[0], r[1]); }
  g.closePath(); g.fill();
  // pinna midrib
  g.strokeStyle = 'rgba(150,170,80,0.55)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * len * 0.95, by + dy * len * 0.95); g.stroke();
}

/** Round-leaf shrub: twigs from the bottom with ~45 leaves. */
function makeShrubTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 702);
  const twigs = 5;
  const leafSpots: [number, number, number][] = [];
  for (let t = 0; t < twigs; t++) {
    const ang = -Math.PI / 2 + (t - (twigs - 1) / 2) * 0.42 + rng.range(-0.1, 0.1);
    let x = W / 2 + rng.range(-20, 20), y = H - 10;
    g.strokeStyle = 'rgb(78,62,40)'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y);
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const a = ang + rng.range(-0.25, 0.25) + (s / segs) * (t - 2) * 0.2;
      x += Math.cos(a) * 60; y += Math.sin(a) * 60;
      g.lineTo(x, y);
      if (s > 0) for (let l = 0; l < 4; l++) leafSpots.push([x + rng.range(-34, 34), y + rng.range(-28, 28), rng.range(12, 22)]);
    }
    g.stroke();
  }
  for (const [x, y, r] of leafSpots) {
    const hue = rng.range(-1, 1);
    const light = rng.range(0, 1);
    g.fillStyle = `rgb(${70 + hue * 10 + light * 40},${104 + hue * 8 + light * 44},${38 + hue * 6 + light * 10})`;
    g.beginPath(); g.ellipse(x, y, r, r * rng.range(0.75, 1), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(170,190,90,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y + r * 0.8); g.lineTo(x, y - r * 0.8); g.stroke();
  }
  return canvasTexture(c);
}

/** Dark pebbles: a scatter of shaded grey ellipses with a light rim. */
function makeStoneTexture() {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 704);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(24, W - 24), y = rng.range(24, H - 24), rx = rng.range(7, 16), ry = rx * rng.range(0.6, 0.9), a = rng.range(0, Math.PI);
    const v = rng.range(0, 1);
    const grad = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, rx);
    grad.addColorStop(0, `rgb(${96 + v * 40},${94 + v * 38},${90 + v * 34})`);
    grad.addColorStop(1, `rgb(${34 + v * 14},${33 + v * 12},${32 + v * 10})`);
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}

/** Moss: a velvety stipple of tiny dark-green tufts, dense in the middle, ragged at the edge. */
function makeMossTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 705);
  // base cushion
  for (let i = 0; i < 40; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.8 * S * 0.28;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(10, 26);
    const v = rng.range(0, 1);
    g.fillStyle = `rgb(${30 + v * 16},${52 + v * 22},${18 + v * 8})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // tufts: dense in the middle, thinning outwards, brighter specks on top
  for (let i = 0; i < 3200; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.55 * S * 0.47;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(1.2, 3.6);
    const v = rng.range(0, 1), bright = rng.next() < 0.18;
    g.fillStyle = bright ? `rgb(${92 + v * 30},${122 + v * 30},${44 + v * 10})` : `rgb(${34 + v * 26},${58 + v * 34},${20 + v * 10})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}

/** Reed blades: a few tall, very thin, slightly bent blades with brown seed heads. */
function makeReedTexture() {
  const W = 128, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 706);
  g.lineCap = 'round';
  for (let b = 0; b < 7; b++) {
    const x0 = 14 + (b / 6) * 100 + rng.range(-6, 6), top = rng.range(20, 110), bendX = rng.range(-22, 22);
    const v = rng.range(0, 1);
    g.strokeStyle = `rgb(${96 + v * 40},${120 + v * 30},${40 + v * 16})`;
    g.lineWidth = rng.range(3.5, 5.5);
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + bendX * 0.4, (H + top) / 2, x0 + bendX, top); g.stroke();
    if (b % 3 === 0) {  // seed head
      g.fillStyle = `rgb(${110 + v * 30},${70 + v * 20},36)`;
      g.beginPath(); g.ellipse(x0 + bendX, top + 6, 4.5, 16, bendX * 0.01, 0, Math.PI * 2); g.fill();
    }
  }
  return canvasTexture(c);
}

/** Fallen needles, twigs and a few leaves on a transparent background. */
function makeLitterTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 703);
  g.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30), a = rng.range(0, Math.PI), l = rng.range(30, 70);
    const hue = rng.range(0, 1);
    g.strokeStyle = `rgba(${74 + hue * 42},${50 + hue * 24},${26 + hue * 10},1.0)`;
    g.lineWidth = rng.range(2.5, 4.2);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(40, W - 40), y = rng.range(40, H - 40), a = rng.range(0, Math.PI), l = rng.range(60, 170);
    g.strokeStyle = `rgb(${62 + rng.range(0, 30)},${46 + rng.range(0, 20)},28)`;
    g.lineWidth = rng.range(5, 9);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    g.lineTo(x + rng.range(-10, 10), y + rng.range(-10, 10)); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30);
    g.fillStyle = `rgb(${100 + rng.range(0, 40)},${68 + rng.range(0, 24)},36)`;
    g.beginPath(); g.ellipse(x, y, rng.range(9, 15), rng.range(5, 8), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c);
}
