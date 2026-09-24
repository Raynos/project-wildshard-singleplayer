/**
 * TSL ports of Driftwood's small ShaderMaterials (effects, particles) — found by a distinctive line of their GLSL, so
 * the owners' modules stay untouched; each port reads the material's own `uniforms` objects, live.
 *
 *   meshes   Waterfall sheet + plunge ring · Boundary veil + gate · Sword trail + tip glint · item-pickup orb sphere ·
 *            the painted horizon (HorizonMatte)
 *   points   Waterfall mist · Sword impact stars · item-pickup motes · crossbow / rifle puffs · the castaway's smoke
 *
 * Points: WebGPU rasterises points 1 px wide (no gl_PointSize), so a sized THREE.Points draws nothing here; instead
 * `twinPoints()` hangs a THREE.Sprite child on it with `count` = its point count, whose PointsNodeMaterial reads the
 * Points' own attributes per instance (the owner keeps writing them) and draws each as a camera-facing quad.
 *
 *   shaderPortFor(material)     → a mesh port (GpuLibrary), or undefined
 *   twinPoints(root)            → GpuPath (fixScene cadence): make the sprite twins; syncTwins() every frame
 */
import * as THREE from 'three';
import {
  abs, atan, attribute, cameraPosition, clamp, cos, cross, dFdx, dFdy, dot, float, fract, instancedDynamicBufferAttribute, length, max, mix, modelViewMatrix,
  normalView, normalize, positionLocal, positionViewDirection, positionWorld, pow, screenDPR, select, sin, smoothstep, sqrt, texture, uniform, uv, varying, vec2, vec3, vec4,
} from 'three/tsl';
import { MeshBasicNodeMaterial, PointsNodeMaterial, type Node, type NodeMaterial } from 'three/webgpu';
import { asFloat, asVec3, gpuUniforms } from './bridge';
import { copyState } from './sky';
import { toonNoise } from './toon';

type U = Record<string, THREE.IUniform | undefined>;
function uf(u: U, k: string): Node<'float'> { const r = u[k] as THREE.IUniform<number> | undefined; if (!r) throw new Error(`[gpu/effects] no uniform ${k}`); return uniform(r.value).onRenderUpdate(() => r.value); }
function uc(u: U, k: string): Node<'vec3'> {
  const r = u[k] as THREE.IUniform<THREE.Color | THREE.Vector3> | undefined;
  if (!r) throw new Error(`[gpu/effects] no uniform ${k}`);
  const v = new THREE.Vector3();
  const read = (): THREE.Vector3 => (r.value instanceof THREE.Color ? v.set(r.value.r, r.value.g, r.value.b) : v.copy(r.value));
  return uniform(read().clone()).onRenderUpdate((_f, self) => { self.value.copy(read()); });
}
function basicOf(src: THREE.ShaderMaterial): MeshBasicNodeMaterial { const m = new MeshBasicNodeMaterial(); copyState(src, m); m.fog = src.fog; return m; }

type MeshPort = (src: THREE.ShaderMaterial) => NodeMaterial;
/** [a line of the GLSL fragment shader that names the effect, its port] */
const MESH_PORTS: [string, MeshPort][] = [
  // Waterfall sheet: faceted, foam streaks scrolling down, frayed edges
  ['float streak = wfNoise', (src) => {
    const u = src.uniforms as U, t = uf(u, 'uTime'), F = gpuUniforms().fog;
    const W = positionWorld, vUv = uv();
    const fn = normalize(cross(dFdx(W), dFdy(W)));
    const facet = abs(fn.x.add(fn.z.mul(0.6))).mul(0.18).add(0.82);
    const p = vec2(vUv.x.mul(7), vUv.y.mul(3).sub(t.mul(1.6)));
    const streak = toonNoise(p).mul(0.6).add(toonNoise(p.mul(vec2(2.3, 1.7)).add(4)).mul(0.4));
    const foam = smoothstep(float(0.42).sub(vUv.y.mul(0.25)), float(0.62).sub(vUv.y.mul(0.2)), streak).toVar();
    const water = mix(vec3(0.18, 0.62, 0.72), vec3(0.95, 0.98, 1.0), foam);
    const col = water.mul(facet).mul(F.fogSunColor.mul(0.75).add(0.35));
    const edge = float(1).sub(smoothstep(0.32, 0.5, abs(vUv.x.sub(0.5)).add(toonNoise(vec2(vUv.y.mul(9).sub(t.mul(2)), 3)).sub(0.5).mul(0.12))));
    const a = edge.mul(mix(float(0.72), float(0.95), foam)).mul(smoothstep(0, 0.04, vUv.y.add(0.02)));
    const m = basicOf(src); m.colorNode = vec4(col, a); return m;
  }],
  // Waterfall plunge ring: spreading rings broken by noise, a foamy core
  ['float wave = fract(r * 3.0', (src) => {
    const u = src.uniforms as U, t = uf(u, 'uTime'), R = uf(u, 'uR'), C = uc(u, 'uCentre'), F = gpuUniforms().fog;
    const vL = varying(positionLocal.xz.sub(C.xz), 'vL');
    const r = length(vL).div(R).toVar();
    const ang = atan(vL.y, vL.x);
    const wave = fract(r.mul(3).sub(t.mul(0.9)));
    const ring = smoothstep(0.75, 0.9, wave).mul(float(1).sub(smoothstep(0.93, 1, wave)));
    const n = toonNoise(vec2(ang.mul(3), r.mul(4).sub(t)));
    const core = float(1).sub(smoothstep(0.08, 0.35, r));
    const foam = max(core.mul(n.mul(0.4).add(0.6)), ring.mul(smoothstep(0.35, 0.7, n))).mul(float(1).sub(smoothstep(0.7, 1, r)));
    const m = basicOf(src); m.colorNode = vec4(vec3(0.95, 0.98, 1.0).mul(F.fogSunColor.mul(0.75).add(0.35)), foam.mul(0.9)); return m;
  }],
  // Boundary veil: a faint grid wall that fades up, scanning
  ['float hgrid = ', (src) => {
    const t = uf(src.uniforms, 'uTime'), W = positionWorld, h = uv().y;
    const g = (v: Node<'float'>): Node<'float'> => smoothstep(0.96, 1, fract(v)).add(smoothstep(0.04, 0, fract(v)));
    const grid = max(g(W.x.mul(0.1)), g(W.z.mul(0.1)));
    const hgrid = g(W.y.mul(0.5));
    const scan = sin(W.y.mul(6).sub(t.mul(2))).mul(0.5).add(0.5);
    const oneMinusH = float(1).sub(h);
    const a = oneMinusH.mul(oneMinusH).mul(0.05).add(max(grid, hgrid).mul(oneMinusH).mul(0.16).mul(scan.mul(0.4).add(0.6)));
    const m = basicOf(src); m.colorNode = vec4(vec3(0.35, 0.85, 1.0).mul(a), a); return m;
  }],
  // Boundary gate: a hex-shimmer field with rings climbing it
  ['float hex = abs(sin(', (src) => {
    const t = uf(src.uniforms, 'uTime'), vUv = uv();
    const p = vUv.sub(0.5);
    const edge = smoothstep(0.5, 0.42, abs(p.x)).mul(smoothstep(0.5, 0.42, abs(p.y)));
    const hex = abs(sin(vUv.x.mul(60).add(sin(vUv.y.mul(40).add(t))))).mul(0.5);
    const ring = smoothstep(0.02, 0, abs(fract(vUv.y.mul(4).sub(t.mul(0.3))).sub(0.5)).sub(0.45));
    const a = hex.mul(0.05).add(0.06).add(ring.mul(0.12)).mul(float(1).sub(edge.mul(0.5))).add(float(1).sub(edge).mul(0.35));
    const m = basicOf(src); m.colorNode = vec4(vec3(0.4, 0.9, 1.0).mul(a), a); return m;
  }],
  // Sword arc trail: feathered inner edge, a bright core line at the tip
  ['uniform float uInner', (src) => {
    const u = src.uniforms as U, col = uc(u, 'uColor'), inner = uf(u, 'uInner');
    const vA = attribute<'float'>('aAlpha', 'float'), vE = attribute<'float'>('aEdge', 'float');
    const body = mix(inner, float(1), smoothstep(0, 0.85, vE));
    const core = smoothstep(0.78, 0.96, vE).mul(float(1).sub(smoothstep(0.985, 1, vE)));
    const m = basicOf(src); m.colorNode = vec4(col.mul(core.mul(0.8).add(1)), vA.mul(body.mul(float(1).sub(core.mul(0.3))).add(core.mul(0.9)))); return m;
  }],
  // Sword heavy's tip glint: a spinning four-point star + glow
  ['uniform float uRot', (src) => {
    const u = src.uniforms as U, alpha = uf(u, 'uAlpha'), rot = uf(u, 'uRot');
    const p0 = uv().sub(0.5).mul(2), c = cos(rot), s = sin(rot);
    const p = vec2(c.mul(p0.x).sub(s.mul(p0.y)), s.mul(p0.x).add(c.mul(p0.y))).toVar();
    const d = abs(p).mul(0.85);
    const st = sqrt(d.x).add(sqrt(d.y));
    const star = select(st.lessThan(1), pow(max(float(1).sub(st), 0), 0.6), float(0));
    const glow0 = max(float(1).sub(length(p).mul(1.5)), 0);
    const a = star.mul(1.6).add(glow0.mul(glow0).mul(1.3)).mul(alpha);
    const m = basicOf(src); m.colorNode = vec4(1.0, 0.97, 0.82, a); m.maskNode = a.greaterThan(0.002); return m;
  }],
  // the item-pickup orb: Fresnel rim + breathing haze + a drifting scanline
  ['float band = smoothstep(0.02, 0.0, abs(fract(vY', (src) => {
    const u = src.uniforms as U, col = uc(u, 'uColor'), t = uf(u, 'uTime'), alpha = uf(u, 'uAlpha'), rimK = uf(u, 'uRim'), haze = uf(u, 'uHaze');
    const vY = varying(positionLocal.y, 'vY');
    const f = float(1).sub(abs(dot(normalView, positionViewDirection)));
    const rim = pow(f, 3.5).mul(rimK);
    const fill = haze.mul(sin(t.mul(1.7).add(vY.mul(6))).mul(0.15).add(0.85));
    const band = smoothstep(0.02, 0, abs(fract(vY.mul(1.3).sub(t.mul(0.12))).sub(0.5)).sub(0.48)).mul(0.08);
    const m = basicOf(src); m.colorNode = vec4(col.mul(rim.add(fill).add(band)), alpha); return m;
  }],
  // the painted horizon (HorizonMatte.ts): day / night paintings, tinted by the sky's palette, hazed at the feet
  ['uniform sampler2D tNight', (src) => {
    const u = src.uniforms;
    // the paintings replace the placeholder textures once decoded: a zero-valued uniform in the graph re-points the
    // texture nodes every render (a TextureNode's own onRenderUpdate is not called for its sampled binding)
    const tex = (k: string): Node<'vec4'> => {
      const r = u[k] as THREE.IUniform<THREE.Texture> | undefined;
      if (!r) throw new Error(`[gpu/effects] no uniform ${k}`);
      const node = texture(r.value);
      const follow = uniform(0).onRenderUpdate(() => { if (node.value !== r.value) node.value = r.value; return 0; });
      return node.sample(uv().add(follow));
    };
    const day = tex('tDay'), night = tex('tNight');
    const fade = uf(u, 'uFade'), nightMix = uf(u, 'uNightMix'), horizonV = uf(u, 'uHorizonV'), gain = uf(u, 'uGain'), nightGain = uf(u, 'uNightGain');
    const hor = uc(u, 'uHorizon'), lit = uc(u, 'uCloudLit'), glow = uc(u, 'uSunGlow'), sun = uc(u, 'uSunDir'), midday = uc(u, 'uMiddayLit');
    const vUv = uv();
    const tint = clamp(lit.div(midday), 0, 1.6);
    const col0 = mix(day.rgb.mul(tint).mul(gain), night.rgb.mul(nightGain), nightMix);
    const a0 = mix(day.a, night.a, nightMix);
    const above = vUv.y.sub(horizonV);
    const col1 = mix(col0, hor, mix(float(0.22), float(0.4), nightMix).mul(float(1).sub(smoothstep(0, 0.2, above))));
    const dir = normalize(positionWorld.sub(cameraPosition));
    const s = max(dot(dir, sun), 0);
    const col = col1.add(glow.mul(pow(s, 8).mul(0.3)).mul(float(1).sub(nightMix.mul(0.7))));
    const a = a0.mul(float(1).sub(smoothstep(0.9, 0.99, vUv.y))).mul(smoothstep(0, 0.05, vUv.y));
    const m = basicOf(src); m.colorNode = vec4(col, a.mul(fade)); return m;
  }],
];

export function shaderPortFor(material: THREE.Material): (() => NodeMaterial) | undefined {
  if (!(material instanceof THREE.ShaderMaterial)) return undefined;
  const hit = MESH_PORTS.find(([sig]) => material.fragmentShader.includes(sig));
  return hit ? () => hit[1](material) : undefined;
}

// ───────────────────────────── points → sprite twins ─────────────────────────────

/** a Points' per-point attribute, read per sprite instance */
function perPointAttr(g: THREE.BufferGeometry, name: string, type: 'float' | 'vec3'): Node {
  const a = g.getAttribute(name);
  if (!(a instanceof THREE.BufferAttribute)) throw new Error(`[gpu/effects] points attribute ${name} missing`);
  return instancedDynamicBufferAttribute(a, type);
}
function perPoint(g: THREE.BufferGeometry, name: string, type: 'vec3'): Node<'vec3'>;
function perPoint(g: THREE.BufferGeometry, name: string, type: 'float'): Node<'float'>;
function perPoint(g: THREE.BufferGeometry, name: string, type: 'float' | 'vec3'): Node<'float'> | Node<'vec3'> {
  const n = perPointAttr(g, name, type);
  return type === 'vec3' ? asVec3(n) : asFloat(n);
}

type PointsPort = (src: THREE.Material, pts: THREE.Points) => PointsNodeMaterial;
/** the GL `aSize * uScale / max(0.05, -mv.z)` point size, in the sprite's CSS-pixel units */
function glPointSize(pts: THREE.Points, sizeAttr: Node<'float'>, uScale: Node<'float'>): Node<'float'> {
  const mvz = modelViewMatrix.mul(vec4(perPoint(pts.geometry, 'position', 'vec3'), 1)).z;
  return sizeAttr.mul(uScale).div(max(float(0.05), mvz.negate())).div(screenDPR);
}
function pointsMat(src: THREE.Material): PointsNodeMaterial {
  const m = new PointsNodeMaterial();
  copyState(src, m);
  m.sizeAttenuation = false;
  return m;
}

const POINTS_PORTS: [(m: THREE.Material) => boolean, PointsPort][] = [
  // Sword impact stars: four-point stars, additive
  [(m) => m instanceof THREE.ShaderMaterial && m.fragmentShader.includes('float s = sqrt(d.x) + sqrt(d.y)'), (src, pts) => {
    const u = (src as THREE.ShaderMaterial).uniforms as U;
    const m = pointsMat(src);
    m.positionNode = perPoint(pts.geometry, 'position', 'vec3');
    m.sizeNode = glPointSize(pts, perPoint(pts.geometry, 'aSize', 'float'), uf(u, 'uScale'));
    const vA = perPoint(pts.geometry, 'aAlpha', 'float');
    const d = abs(uv().sub(0.5)).mul(2), s = sqrt(d.x).add(sqrt(d.y));
    m.colorNode = vec4(1.0, 0.93, 0.62, float(1).sub(s).mul(vA).mul(1.4));
    m.maskNode = s.lessThanEqual(1).and(vA.greaterThan(0.001));
    return m;
  }],
  // item-pickup motes: soft round sprites in their own colour
  [(m) => m instanceof THREE.ShaderMaterial && m.fragmentShader.includes('vC * (1.0 + a * 1.5)'), (src, pts) => {
    const u = (src as THREE.ShaderMaterial).uniforms as U;
    const m = pointsMat(src);
    m.positionNode = perPoint(pts.geometry, 'position', 'vec3');
    m.sizeNode = glPointSize(pts, perPoint(pts.geometry, 'aSize', 'float'), uf(u, 'uScale'));
    const vA = perPoint(pts.geometry, 'aAlpha', 'float'), vC = perPoint(pts.geometry, 'aColor', 'vec3');
    const d = uv().sub(0.5), r = dot(d, d).mul(4);
    const a = float(1).sub(r).mul(float(1).sub(r)).mul(vA);
    m.colorNode = vec4(vC.mul(a.mul(1.5).add(1)), a);
    m.maskNode = r.lessThanEqual(1).and(vA.greaterThan(0.001));
    return m;
  }],
  // the crossbow / rifle muzzle puffs and chips: soft round sprites in their own colour
  [(m) => m instanceof THREE.ShaderMaterial && m.fragmentShader.includes('gl_FragColor = vec4(vC, a)'), (src, pts) => {
    const u = (src as THREE.ShaderMaterial).uniforms as U;
    const m = pointsMat(src);
    m.positionNode = perPoint(pts.geometry, 'position', 'vec3');
    m.sizeNode = glPointSize(pts, perPoint(pts.geometry, 'aSize', 'float'), uf(u, 'uScale'));
    const vA = perPoint(pts.geometry, 'aAlpha', 'float'), vC = perPoint(pts.geometry, 'aColor', 'vec3');
    const d = uv().sub(0.5), r = dot(d, d).mul(4);
    m.colorNode = vec4(vC, float(1).sub(r).mul(float(1).sub(r)).mul(vA));
    m.maskNode = r.lessThanEqual(1).and(vA.greaterThan(0.001));
    return m;
  }],
  // Waterfall mist: puffs rising off the plunge pool
  [(m) => m instanceof THREE.ShaderMaterial && m.vertexShader.includes('life * 3.5'), (src, pts) => {
    const u = (src as THREE.ShaderMaterial).uniforms as U, t = uf(u, 'uTime'), F = gpuUniforms().fog;
    const seed = perPoint(pts.geometry, 'seed', 'float');
    const life = fract(t.mul(0.18).add(seed)).toVar();
    const p = perPoint(pts.geometry, 'position', 'vec3').add(vec3(sin(seed.mul(20).add(t.mul(0.4))).mul(life).mul(1.2), life.mul(3.5), cos(seed.mul(13).add(t.mul(0.3))).mul(life).mul(1.2)));
    const m = pointsMat(src);
    m.positionNode = p;
    const mvz = modelViewMatrix.mul(vec4(p, 1)).z;
    m.sizeNode = life.mul(2.6).add(1.6).mul(120).div(max(float(1), mvz.negate())).div(screenDPR);
    const vA = sin(life.mul(3.14159)).mul(0.22);
    const a = smoothstep(0.5, 0.1, length(uv().sub(0.5))).mul(vA);
    m.colorNode = vec4(vec3(0.92, 0.96, 1.0).mul(F.fogSunColor.mul(0.7).add(0.4)), a);
    m.fog = true;
    return m;
  }],
  // the castaway's smoke: PointsMaterial (map, colour, opacity) × per-puff aSize / aAlpha
  [(m) => m instanceof THREE.PointsMaterial && m.customProgramCacheKey().startsWith('castaway-smoke'), (src, pts) => {
    const pm = src as THREE.PointsMaterial;
    const m = pointsMat(src);
    m.positionNode = perPoint(pts.geometry, 'position', 'vec3');
    // three's WebGL points: size × aSize × (drawing-buffer height / 2) / −z; the node path's attenuation does the same in CSS px
    m.sizeAttenuation = true;
    m.sizeNode = perPoint(pts.geometry, 'aSize', 'float').mul(uniform(pm.size).onRenderUpdate(() => pm.size));
    const tex = pm.map;
    const base = vec4(uniform(pm.color.clone()).onRenderUpdate((_f, self) => self.value.copy(pm.color)), 1);
    const col = tex ? base.mul(texture(tex, vec2(uv().x, float(1).sub(uv().y)))) : base;
    m.colorNode = vec4(col.rgb, col.a.mul(perPoint(pts.geometry, 'aAlpha', 'float')));
    m.opacity = pm.opacity;
    m.fog = pm.fog;
    return m;
  }],
];

/** does a Points' material have a sprite-twin port (its own draw is then masked off by the library) */
export function isTwinnedPointsMaterial(m: THREE.Material): boolean { return POINTS_PORTS.some(([test]) => test(m)); }

const twins = new Map<THREE.Points, THREE.Sprite>();
export function twinPoints(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Points)) return;
    const o = obj as THREE.Points;
    if (twins.has(o)) return;
    const mat = o.material as THREE.Material;
    const port = POINTS_PORTS.find(([test]) => test(mat));
    if (!port) return;
    const sprite = new THREE.Sprite();
    Reflect.set(sprite, 'material', port[1](mat, o)); // (a node material on a Sprite: @types only admits SpriteMaterial)
    sprite.frustumCulled = false;
    sprite.renderOrder = o.renderOrder;
    sprite.name = `${o.name || 'points'}-gpu-twin`;
    o.add(sprite);
    twins.set(o, sprite);
  });
}
/** every frame: the twin draws exactly the points the Points would (its draw range) */
export function syncTwins(): void {
  for (const [pts, sprite] of twins) {
    const pos = pts.geometry.getAttribute('position');
    const r = pts.geometry.drawRange;
    sprite.count = Math.max(0, Math.min(r.count, pos.count - r.start));
  }
}
