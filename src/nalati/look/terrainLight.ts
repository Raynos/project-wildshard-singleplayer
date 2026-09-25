/**
 * Look v2 — the terrain's baked light (the Nalati Look Lab, NALATI-MERGE L3; the user's wave-6 variants). Two switches,
 * both off by default (today's look) until the user picks:
 *
 *   terrainShadow  the terrain casts the key light's shadow: the escarpment, the crags' flanks and every ridge throw
 *                  their long dusk shadows across the bowl and the meadow (the static bake, bake.ts, has only the POIs,
 *                  rocks and spruce; the realtime CSM has no terrain caster: Terrain castShadow = false)
 *   terrainAO      the ground's sky visibility (gullies, the foot of a slope, the hollows under the ridges darker) and a
 *                  green bounce off the sunlit meadow into the shade beside it
 *
 * One small GPU pass over the height map (grass.ts terrainHeightTexture, 1 m texels over ±256 m), no scene render: per
 * texel it marches toward the key light and keeps the highest line a ridge casts down over it (so the receivers test
 * their own height against it: a yurt's roof stands out of a shadow its door is in), the distance to that ridge (the
 * softness), how sunlit the ground is (N·L × that shadow; mipmapped, it is the bounce), and eight horizon angles (the
 * AO). Re-baked with the static bake when the key has swung ~1.5° (sky.sunDir, after the lighting cheat), ~1 ms.
 *
 * The receivers read `painterlyUniforms` (src/world/painterly.ts P_TERRAIN_GLSL): every painterly mesh (the terrain,
 * the POIs, the creatures) takes the shadow on its sun term; the terrain its AO on the ambient (and a little on the
 * sun) plus the bounce; the grass blades, cards and flowers the same (grass.ts).
 */
import * as THREE from 'three';
import { TIER } from '../../core/tier';
import { onGpuRestored } from '../../core/gpuOnly';
import { painterlyUniforms } from '../../world/painterly';

const ORG = -256, SPAN = 512;
const SIZE = TIER === 'phone' ? 512 : 1024;
const REBAKE_COS = Math.cos(1.5 * Math.PI / 180);

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tHeight;
  uniform vec3 uKey;      // toward the key light (unit)
  uniform float uMaxH;    // the highest ground anywhere (m): a march stops once nothing further can rise above its line
  varying vec2 vUv;
  float H(vec2 xz) { return texture2D(tHeight, (xz - ${ORG.toFixed(1)}) / ${SPAN.toFixed(1)}).r; }
  void main() {
    vec2 xz = ${ORG.toFixed(1)} + vUv * ${SPAN.toFixed(1)};
    float h0 = H(xz);
    // the ground's normal (central differences over 1 m)
    vec3 n = normalize(vec3(H(xz - vec2(1.0, 0.0)) - H(xz + vec2(1.0, 0.0)), 2.0, H(xz - vec2(0.0, 1.0)) - H(xz + vec2(0.0, 1.0))));
    // the shadow: march toward the key; each sample's ridge casts a line down over xz at the key's slope
    float top = -1e4, occD = 0.0;
    if (uKey.y > 0.002) {
      float hl = length(uKey.xz);
      vec2 dir = hl > 1e-4 ? uKey.xz / hl : vec2(1.0, 0.0);
      float slope = uKey.y / max(hl, 1e-4);
      float t = 0.75;
      for (int i = 0; i < 96; i++) {
        float line = H(xz + dir * t) - t * slope;
        if (line > top) { top = line; occD = t; }
        if (uMaxH - t * slope < top || t > 700.0) break;
        t = t * 1.05 + 0.5;
      }
    } else {
      top = 1e4; occD = 1.0;   // the key under the horizon: everything is in shade
    }
    float lit = smoothstep(-1.0, 1.0, (h0 + 0.1 - top) / (0.12 + 0.009 * occD));
    float sun = max(dot(n, uKey), 0.0) * lit;
    // the AO: eight horizon angles out to ~45 m, each measured from the ground's own tangent plane (so an even slope is
    // as open as a flat meadow; a gully, the foot of a slope, a hollow under a ridge are not): vis = mean of
    // 1 − sin(horizon − tangent)
    vec2 grad = vec2(H(xz + vec2(1.0, 0.0)) - H(xz - vec2(1.0, 0.0)), H(xz + vec2(0.0, 1.0)) - H(xz - vec2(0.0, 1.0))) * 0.5;
    float vis = 0.0;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398 + 0.39;
      vec2 d = vec2(cos(a), sin(a));
      float m = -1e3;
      float r = 1.5;
      for (int j = 0; j < 10; j++) {
        m = max(m, (H(xz + d * r) - h0) / r);
        r *= 1.42;
      }
      vis += 1.0 - sin(max(atan(m) - atan(dot(grad, d)), 0.0));
    }
    gl_FragColor = vec4(top, occD, sun, vis / 8.0);
  }`;

export class TerrainLightBake {
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly mat: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly lastDir = new THREE.Vector3(0, -1, 0);
  private readonly uKey = { value: new THREE.Vector3(0, 1, 0) };
  private dirty = true;
  private shadowOn = false;
  private aoOn = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, tHeight: THREE.DataTexture) {
    this.rt = new THREE.WebGLRenderTarget(SIZE, SIZE, {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    });
    this.rt.texture.name = 'nalati-terrain-light';
    // the highest ground: the march's early out
    const img: unknown = tHeight.image;
    const data = typeof img === 'object' && img !== null && 'data' in img ? img.data : null;
    let maxH = data instanceof Uint16Array ? -1e4 : 400;
    if (data instanceof Uint16Array) for (let i = 0; i < data.length; i++) maxH = Math.max(maxH, THREE.DataUtils.fromHalfFloat(data[i] ?? 0));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tHeight: { value: tHeight }, uKey: this.uKey, uMaxH: { value: maxH + 1 } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    const u = painterlyUniforms;
    u.tPTerrain.value = this.rt.texture;
    u.uPTerrainXf.value.set(ORG, ORG, 1 / SPAN, Math.log2(SIZE / 512) + 3.5); // the bounce: a ~11 m blur
    onGpuRestored(() => { this.dirty = true; });
    if (typeof window !== 'undefined') Object.assign(window, { __terrainLight: this });
  }

  /** the Look Lab switches (lab.ts): the uniforms' strengths; the first switch on bakes */
  set(o: { shadow: boolean; ao: boolean }): void {
    if (o.shadow === this.shadowOn && o.ao === this.aoOn) return;
    this.shadowOn = o.shadow; this.aoOn = o.ao;
    const k = painterlyUniforms.uPTerrainK.value;
    k.x = o.shadow ? 1 : 0;
    k.y = o.ao ? 1 : 0;
    k.z = o.ao ? 1 : 0;
    this.dirty = true;
  }

  /** each frame, after the lighting cheat: re-bake when the key has swung past the threshold (and a switch is on) */
  update(keyDir: THREE.Vector3): void {
    if (!this.shadowOn && !this.aoOn) return;
    if (!this.dirty && keyDir.dot(this.lastDir) > REBAKE_COS) return;
    this.lastDir.copy(keyDir);
    this.dirty = false;
    this.uKey.value.copy(keyDir).normalize();
    const r = this.renderer;
    const prev = r.getRenderTarget(), prevAuto = r.autoClear;
    r.autoClear = true;
    try {
      r.setRenderTarget(this.rt);
      r.render(this.scene, this.cam);
    } finally {
      r.setRenderTarget(prev);
      r.autoClear = prevAuto;
    }
    painterlyUniforms.uPTerrainK.value.w = 1;
  }
}
