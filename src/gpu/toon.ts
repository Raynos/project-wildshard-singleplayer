/**
 * The low-poly shard's toon lighting (src/world/stylize.ts, DRIFTWOOD-REMASTER L1) as a TSL lighting model.
 *
 *   installToonLibrary(library, sunLight)   // GpuPath does it: every MeshStandard / MeshPhysical material becomes a toon one
 *   new ToonStandardNodeMaterial()          // for ports that need the toon ramp plus their own nodes (ocean, ground cover…)
 *
 * The same model as the GLSL chunk patch, term for term: a two-band ramp on N·L × the cast shadow for the sun (the CSM
 * light, recognised by identity — no direction test needed here), a sun-coloured banded rim on vertical-ish faces, a
 * warm terminator band, drifting cloud shade, W4 caustics under the sea, GGX specular only below roughness 0.72; the
 * shade band is the hemisphere light + the violet lift; the IBL keeps its specular and loses its diffuse. Point lights
 * keep the physical path. A material with `defines.NO_TOON` stays physical; `defines.OCEAN_SURFACE` skips caustics.
 */
import * as THREE from 'three';
import {
  AnalyticLightNode, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, PhysicalLightingModel,
  type LightingModelDirectInput, type Node, type NodeBuilder, type StandardNodeLibrary,
} from 'three/webgpu';
import {
  BRDF_GGX, BRDF_Lambert, cameraViewMatrix, diffuseContribution, dot, float, floor, fract, max, mix, normalView, positionViewDirection,
  positionWorld, roughness, saturate, smoothstep, specularColorBlended, uniform, vec2, vec3, vec4, abs, exp, pow,
} from 'three/tsl';
import { asVec3, gpuUniforms } from './bridge';

const RECIPROCAL_PI = 1 / Math.PI;

/** fract-dot hash, stylize.ts toonHash */
export function toonHash(pIn: Node<'vec2'>): Node<'float'> {
  const p0 = fract(pIn.mul(vec2(123.34, 456.21)));
  const p = p0.add(dot(p0, p0.add(45.32)));
  return fract(p.x.mul(p.y));
}
/** value noise, stylize.ts toonNoise */
export function toonNoise(p: Node<'vec2'>): Node<'float'> {
  const i = floor(p).toVar(), f = fract(p).toVar();
  const u = f.mul(f).mul(f.mul(-2).add(3));
  return mix(mix(toonHash(i), toonHash(i.add(vec2(1, 0))), u.x), mix(toonHash(i.add(vec2(0, 1))), toonHash(i.add(vec2(1, 1))), u.x), u.y);
}

/** 1 = open sky, lower under a drifting cloud shadow (L4) */
function toonCloud(w: Node<'vec3'>): Node<'float'> {
  const T = gpuUniforms().toon;
  const p = w.xz.add(T.uCloudWind.mul(T.uCloudTime)).div(T.uCloudScale).toVar();
  const n = toonNoise(p).mul(0.65).add(toonNoise(p.mul(2.3).add(7.1)).mul(0.35));
  return float(1).sub(T.uCloudShadow.mul(smoothstep(0.46, 0.68, n)));
}

/** W4 caustics under the sea surface (0 above it) */
function toonCaustics(w: Node<'vec3'>): Node<'float'> {
  const T = gpuUniforms().toon;
  const d = T.uSeaLevel.sub(w.y).toVar();
  const p = w.xz.mul(0.42).toVar(), t = T.uCloudTime.mul(0.55).toVar();
  const a = toonNoise(p.add(vec2(t.mul(0.31), t.mul(0.17))));
  const b = toonNoise(p.mul(1.63).sub(vec2(t.mul(0.21), t.mul(-0.29))).add(3.7));
  const c = pow(float(1).sub(abs(a.sub(b))), 9);
  return c.mul(T.uCaustics).mul(smoothstep(0.7, 1.8, d)).mul(exp(d.mul(-0.18))).mul(d.greaterThan(0).select(1, 0));
}

export class ToonLightingModel extends PhysicalLightingModel {
  constructor(private sun: THREE.DirectionalLight, private sunColor: Node<'vec3'>, private caustics: boolean) { super(); }

  override direct(input: LightingModelDirectInput, builder: NodeBuilder): void {
    const { lightDirection, lightColor, lightNode } = input;
    const directDiffuse = input.reflectedLight.directDiffuse as Node<'vec3'>, directSpecular = input.reflectedLight.directSpecular as Node<'vec3'>;
    if (!(lightNode instanceof AnalyticLightNode) || lightNode.light !== this.sun) { super.direct(input, builder); return; }
    const T = gpuUniforms().toon;
    const sunCol = this.sunColor;
    const L = lightDirection as Node<'vec3'>, C = lightColor as Node<'vec3'>;
    const shadow = saturate(dot(C, vec3(1)).div(max(dot(sunCol, vec3(1)), 1e-5))).toVar();
    const NdL = dot(normalView, L).toVar();
    const band = smoothstep(0.14, 0.2, NdL).mul(smoothstep(0.25, 0.75, shadow)).toVar();
    const grade = saturate(NdL).mul(0.2).add(0.8);
    const alb = diffuseContribution;
    const cloud = toonCloud(positionWorld).toVar();
    let irr = sunCol.mul(band.mul(grade).mul(cloud).add(float(1).sub(band).mul(T.uToonShadeGrade).mul(saturate(NdL)).mul(0.5)));
    if (this.caustics) irr = irr.add(sunCol.mul(vec3(0.7, 1.0, 1.05)).mul(band).mul(cloud).mul(toonCaustics(positionWorld)));
    const term = band.mul(float(1).sub(band)).mul(4);
    const satAlb = alb.mul(alb).div(max(max(alb.r, max(alb.g, alb.b)), 1e-3));
    directDiffuse.addAssign(alb.mul(irr).add(satAlb.mul(T.uToonTerm).mul(term).mul(sunCol)).mul(RECIPROCAL_PI));
    // rim on the lit side of vertical-ish faces (never the ground)
    const nW = vec4(normalView, 0).mul(cameraViewMatrix).xyz.normalize();
    const fres = smoothstep(0.55, 0.8, float(1).sub(saturate(dot(normalView, positionViewDirection))));
    const rim = fres.mul(smoothstep(-0.3, 0.2, NdL)).mul(shadow).mul(cloud).mul(smoothstep(0.85, 0.4, abs(nW.y)));
    directDiffuse.addAssign(T.uToonRim.mul(rim).mul(sunCol).mul(RECIPROCAL_PI).mul(alb.add(0.35)));
    // sun specular only on the glossy bits, lit band only
    const gloss = roughness.lessThan(0.72).select(1, 0);
    const spec = asVec3(BRDF_GGX({ lightDirection: L, f0: specularColorBlended, f90: float(1), roughness }));
    const msc = this.multiScatteringCompensation ? asVec3(this.multiScatteringCompensation) : vec3(1);
    directSpecular.addAssign(saturate(NdL).mul(sunCol).mul(band).mul(gloss).mul(spec).mul(msc));
  }

  override indirectDiffuse(builder: NodeBuilder): void {
    const ctx = builder.context as { irradiance: Node<'vec3'>; reflectedLight: { indirectDiffuse: Node<'vec3'> } };
    ctx.reflectedLight.indirectDiffuse.addAssign(ctx.irradiance.add(gpuUniforms().toon.uToonLift).mul(asVec3(BRDF_Lambert({ diffuseColor: diffuseContribution }))));
  }

  override indirectSpecular(builder: NodeBuilder): void {
    // the IBL's diffuse (irradiance) is dropped; its specular stays for metals and glossy bits
    const ctx = builder.context as { iblIrradiance: Node<'vec3'> };
    const keep = ctx.iblIrradiance;
    ctx.iblIrradiance = vec3(0);
    super.indirectSpecular(builder);
    ctx.iblIrradiance = keep;
  }
}

/** the sun the toon ramp keys on, and its unshadowed colour × intensity (set by GpuPath before anything compiles) */
const toonSun: { light: THREE.DirectionalLight | null; color: Node<'vec3'> | null } = { light: null, color: null };
export function setToonSun(light: THREE.DirectionalLight): void {
  toonSun.light = light;
  toonSun.color = uniform(new THREE.Vector3()).onRenderUpdate((_f, self) => self.value.set(light.color.r, light.color.g, light.color.b).multiplyScalar(light.intensity));
}

function toonModel(material: THREE.Material): ToonLightingModel | PhysicalLightingModel {
  const defs = material.defines;
  if (!toonSun.light || !toonSun.color || (defs && 'NO_TOON' in defs)) return new PhysicalLightingModel();
  return new ToonLightingModel(toonSun.light, toonSun.color, !(defs && 'OCEAN_SURFACE' in defs));
}

export class ToonStandardNodeMaterial extends MeshStandardNodeMaterial {
  override setupLightingModel(): PhysicalLightingModel { return toonModel(this); }
}
export class ToonPhysicalNodeMaterial extends MeshPhysicalNodeMaterial {
  override setupLightingModel(): PhysicalLightingModel { return toonModel(this); }
}

/** the global patch: the library maps the plain lit materials to the toon ones (stylize.ts' chunk patch, per material) */
export function installToonLibrary(library: StandardNodeLibrary): void {
  // (addMaterial refuses to redefine a type: replace the StandardNodeLibrary's entries in place)
  library.materialNodes.set('MeshStandardMaterial', ToonStandardNodeMaterial);
  library.materialNodes.set('MeshPhysicalMaterial', ToonPhysicalNodeMaterial);
}
