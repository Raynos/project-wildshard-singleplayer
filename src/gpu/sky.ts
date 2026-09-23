/**
 * The stylized sky in TSL (src/world/StylizedSky.ts — the gradient dome and the faceted cumulus — and the gas giant's
 * body + ring from src/world/Sky.ts buildGasGiant). Each port reads the WebGL ShaderMaterial's own uniform objects,
 * so DayNight's palette changes reach both paths.
 *
 *   skyDomeMaterial(src)  cumulusMaterial(src)  giantBodyMaterial(src)  giantRingMaterial(src)
 *
 * `src` is the ShaderMaterial the WebGL path draws with; the returned node material carries its render state.
 */
import * as THREE from 'three';
import {
  abs, atan, attribute, cameraPosition, cos, dot, float, floor, fract, length, max, mix, modelPosition, modelWorldMatrix, normalLocal,
  normalWorld, positionLocal, positionWorld, pow, select, sin, smoothstep, step, texture, uniform, varying, vec2, vec3, vec4,
} from 'three/tsl';
import { MeshBasicNodeMaterial, type Node, type NodeMaterial } from 'three/webgpu';

type Uniforms = Record<string, THREE.IUniform | undefined>;

/** copy the render state (not the GLSL) of a WebGL material onto its node twin */
export function copyState(src: THREE.Material, dst: NodeMaterial): void {
  dst.name = src.name; dst.side = src.side; dst.transparent = src.transparent; dst.opacity = src.opacity;
  dst.depthWrite = src.depthWrite; dst.depthTest = src.depthTest; dst.blending = src.blending; dst.premultipliedAlpha = src.premultipliedAlpha;
  dst.fog = 'fog' in src && src.fog === true; dst.toneMapped = src.toneMapped; dst.alphaTest = src.alphaTest; dst.colorWrite = src.colorWrite;
  dst.forceSinglePass = src.forceSinglePass; dst.polygonOffset = src.polygonOffset; dst.polygonOffsetFactor = src.polygonOffsetFactor; dst.polygonOffsetUnits = src.polygonOffsetUnits;
  dst.blendSrc = src.blendSrc; dst.blendDst = src.blendDst; dst.blendEquation = src.blendEquation; dst.vertexColors = src.vertexColors;
}

function need(u: Uniforms, k: string): THREE.IUniform {
  const v = u[k];
  if (!v) throw new Error(`[gpu/sky] the WebGL material has no uniform ${k}`);
  return v;
}
function f(u: Uniforms, k: string): Node<'float'> { const r = need(u, k) as THREE.IUniform<number>; return uniform(r.value).onRenderUpdate(() => r.value); }
function c3(u: Uniforms, k: string): Node<'vec3'> {
  const r = need(u, k) as THREE.IUniform<THREE.Color | THREE.Vector3>;
  const v = new THREE.Vector3();
  const read = (): THREE.Vector3 => (r.value instanceof THREE.Color ? v.set(r.value.r, r.value.g, r.value.b) : v.copy(r.value));
  return uniform(read().clone()).onRenderUpdate((_f, self) => { self.value.copy(read()); });
}

function basic(src: THREE.Material): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial();
  copyState(src, m);
  m.fog = false;
  return m;
}

/** the gradient dome: zenith → horizon, below-horizon tint, a bright horizon band, the sun glow, stars at night */
export function skyDomeMaterial(src: THREE.ShaderMaterial): MeshBasicNodeMaterial {
  const u = src.uniforms as Uniforms;
  const zen = c3(u, 'uZenith'), hor = c3(u, 'uHorizon'), below = c3(u, 'uBelow'), glow = c3(u, 'uSunGlow'), sun = c3(u, 'uSunDir'), night = f(u, 'uNight');
  const d = varying(positionLocal).normalize().toVar();
  const h = d.y;
  const col0 = mix(hor, zen, pow(smoothstep(0, 0.75, h), 0.62));
  const col1 = mix(col0, below, smoothstep(0, -0.08, h)).add(hor.mul(0.18).mul(smoothstep(0.06, 0, abs(h.sub(0.01)))));
  const s = max(dot(d, sun), 0).toVar();
  const col2 = col1.add(glow.mul(pow(s, 8).mul(0.35).add(pow(s, 64).mul(0.6))).mul(float(1).sub(night.mul(0.7))));
  // stars: a hashed cell grid (h31), only above the horizon at night
  const cell = floor(d.mul(180));
  const p0 = fract(cell.mul(0.1031));
  const p = p0.add(dot(p0, p0.zyx.add(31.32)));
  const h31 = fract(p.x.add(p.y).mul(p.z));
  const st = step(0.9965, h31).mul(smoothstep(0.02, 0.25, h)).mul(select(h.greaterThan(0), float(1), float(0)));
  const m = basic(src);
  m.colorNode = col2.add(vec3(0.9, 0.95, 1.1).mul(st).mul(night).mul(1.6));
  return m;
}

/** the faceted cumulus ring: two-band sun ramp, darker bellies, silver lining, melt into the horizon at the bottom */
export function cumulusMaterial(src: THREE.ShaderMaterial): MeshBasicNodeMaterial {
  const u = src.uniforms as Uniforms;
  const sun = c3(u, 'uSunDir'), lit = c3(u, 'uCloudLit'), shade = c3(u, 'uCloudShade'), hor = c3(u, 'uHorizon'), glow = c3(u, 'uSunGlow'), time = f(u, 'uTime');
  const a = time.mul(0.0006), ca = cos(a), sa = sin(a);
  const m = basic(src);
  m.positionNode = vec3(ca.mul(positionLocal.x).sub(sa.mul(positionLocal.z)), positionLocal.y, sa.mul(positionLocal.x).add(ca.mul(positionLocal.z)));
  const nObj = vec3(ca.mul(normalLocal.x).sub(sa.mul(normalLocal.z)), normalLocal.y, sa.mul(normalLocal.x).add(ca.mul(normalLocal.z)));
  const N = varying(modelWorldMatrix.mul(vec4(nObj, 0)).xyz).normalize().toVar();
  const belly = varying(attribute<'float'>('belly', 'float'));
  const W = positionWorld;
  const V = cameraPosition.sub(W).normalize().toVar();
  const NdL = dot(N, sun);
  const litF = smoothstep(-0.05, 0.2, NdL).mul(NdL.mul(0.18).add(0.82));
  const col0 = mix(mix(shade, lit, litF), shade.mul(0.82), belly.mul(0.55));
  const fres = pow(float(1).sub(abs(dot(N, V))), 2.5);
  const behind = pow(max(dot(V.negate(), sun), 0), 3);
  const col1 = col0.add(glow.mul(fres).mul(behind.mul(1.6).add(0.25)));
  const dir = W.sub(cameraPosition).normalize();
  m.colorNode = mix(col1, hor, smoothstep(0.1, 0, dir.y).mul(0.7));
  return m;
}

/** the gas giant's body: bands wrapped about the ring axis, soft terminator, limb darkening, sky haze at the limb */
export function giantBodyMaterial(src: THREE.ShaderMaterial): MeshBasicNodeMaterial {
  const u = src.uniforms as Uniforms;
  const sun = c3(u, 'uSunDir'), haze = c3(u, 'uHaze'), axis = c3(u, 'uAxis'), time = f(u, 'uTime'), crisp = f(u, 'uCrisp');
  const bands = need(u, 'tBands').value as THREE.Texture;
  const N = normalWorld.toVar();
  const V = cameraPosition.sub(positionWorld).normalize();
  const T = axis.cross(vec3(0, 0, 1)).normalize().toVar();
  const B = axis.cross(T);
  const lat = dot(N, axis);
  const lon = atan(dot(N, B), dot(N, T)).div(6.2831853).add(time.mul(0.0025));
  const col = texture(bands, vec2(lon, lat.mul(0.5).add(0.5))).rgb.toVar();
  const mu = max(dot(N, V), 0).toVar();
  const day = smoothstep(-0.35, 0.3, dot(N, sun)).toVar();
  const limb = mu.mul(0.55).add(0.45);
  const lit = col.mul(day.mul(0.95).add(0.24)).mul(limb).add(col.mul(vec3(0.05, 0.08, 0.14)).mul(float(1).sub(day)));
  const h = pow(float(1).sub(mu), 2.4).mul(0.45).add(0.1).mul(float(1).sub(crisp.mul(0.7)));
  const m = basic(src);
  m.colorNode = vec4(mix(lit, haze, h), mix(float(0.92).sub(pow(float(1).sub(mu), 3).mul(0.25)), float(1), crisp));
  return m;
}

/** the ring: radial profile with the Cassini gap, hidden behind the body, darkened in its shadow */
export function giantRingMaterial(src: THREE.ShaderMaterial): MeshBasicNodeMaterial {
  const u = src.uniforms as Uniforms;
  const sun = c3(u, 'uSunDir'), haze = c3(u, 'uHaze'), axis = c3(u, 'uAxis'), radius = f(u, 'uRadius'), crisp = f(u, 'uCrisp');
  const C = modelPosition; // the planet's centre: the ring sits at the group origin
  const hitsBody = (o: Node<'vec3'>, d: Node<'vec3'>, tmax: Node<'float'>): Node<'bool'> => {
    const t = dot(C.sub(o), d).toVar();
    return t.greaterThanEqual(0).and(t.lessThanEqual(tmax)).and(length(o.add(d.mul(t)).sub(C)).lessThan(radius.mul(0.995)));
  };
  const r = length(positionLocal.xy).div(radius);
  const t = r.sub(1.38).div(0.7).toVar();
  const a = sin(t.mul(31)).mul(sin(t.mul(7.3).add(1))).mul(0.38).add(0.62)
    .mul(smoothstep(0, 0.08, t)).mul(smoothstep(1, 0.86, t))
    .mul(float(1).sub(smoothstep(0.03, 0, abs(t.sub(0.56))).mul(0.85)))
    .mul(float(1).sub(smoothstep(0.012, 0, abs(t.sub(0.3))).mul(0.5)))
    .mul(mix(float(1), float(0.55), smoothstep(0.6, 1, t)));
  const bright = sin(t.mul(19).add(0.4)).mul(0.45).add(0.55);
  const W = positionWorld.toVar();
  const toEye = cameraPosition.sub(W).toVar();
  const dEye = length(toEye).toVar();
  const V = toEye.div(dEye).toVar();
  const shadow = select(hitsBody(W, sun, float(1e9)), float(0.22), float(1));
  const sameSide = select(dot(axis, V).sign().equal(dot(axis, sun).sign()), float(1), float(0.6));
  const lit = abs(dot(axis, sun)).mul(0.5).add(0.5).mul(sameSide).mul(shadow);
  const col = mix(vec3(0.98, 0.95, 0.88).mul(lit.mul(0.9).add(0.45)).mul(bright), haze, float(0.2).mul(float(1).sub(crisp.mul(0.6))));
  const m = basic(src);
  m.colorNode = vec4(col, a.mul(mix(float(0.8), float(0.95), crisp)));
  m.maskNode = hitsBody(W, V, dEye).not();
  return m;
}
