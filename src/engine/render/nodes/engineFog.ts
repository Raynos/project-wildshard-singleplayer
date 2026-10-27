/**
 * The engine's height fog as nodes (SHARD-PLATFORM SF59 step 2, fix 3; sf59-tsl-spike.md §2.2): the same maths as
 * Atmosphere.ts's `fog_fragment` chunk, for graph materials, which never read THREE.ShaderChunk. It reads the engine's own
 * uniform objects by reference (`fogUniforms`, `weatherUniforms`, `weatherFogUniforms` and the scene fog's colour), so a
 * value set on them reaches classic and node materials alike, and it compiles in the same optional terms the chunk did
 * (`atmosphereTerms()`: Pine Hollow's slab-edge haze and fog bank, a level's weather fog). EngineNodesHandler appends it
 * after the output transform, where classic three applies fog. Parity with the chunk: scripts/tsl-spike (`family` vs
 * `tsl`, ≥ 40 dB).
 */
import type * as THREE from 'three';
import { ConvertNode, MathNode, type Node } from 'three/webgpu';
import { Fn, abs, cameraPosition, clamp, dot, exp, float, length, max, mix, positionWorld, pow, reference, select, smoothstep, texture, vec2, vec3, vec4 } from 'three/tsl';
import type { NodeFogColourRamp, NodeFogContext, NodeFogPanorama } from '../fogPatches';
import { atmosphereTerms, fogUniforms, weatherFogUniforms, weatherUniforms } from '../../world/Atmosphere';

const f = (u: { value: number }): Node<'float'> => reference('value', 'float', u);
const v3 = (u: { value: THREE.Vector3 }): Node<'vec3'> => reference('value', 'vec3', u);
const v4 = (u: { value: THREE.Vector4 }): Node<'vec4'> => reference('value', 'vec4', u);
const col = (u: { value: THREE.Color }): Node<'color'> => reference('value', 'color', u);

type FogInputs = Readonly<Record<string, Node>>;
const input = (inputs: FogInputs, name: string): Node => {
  const value = inputs[name];
  if (value === undefined) throw new Error(`engineFog: the fog function lacks ${name}`);
  return value;
};
const fl = (inputs: FogInputs, name: string): Node<'float'> => new ConvertNode<'float'>(input(inputs, name), 'float');
const vec3In = (inputs: FogInputs, name: string): Node<'vec3'> => new ConvertNode<'vec3'>(input(inputs, name), 'vec3');
const vec4In = (inputs: FogInputs, name: string): Node<'vec4'> => new ConvertNode<'vec4'>(input(inputs, name), 'vec4');
type Layout = { name: string; type: string }[];
/** a shared layout function per variant key, made once (G717.O4.4: three generates a layout function's code once per
 *  renderer, so a node build pays one call for its fog instead of the fog's ~70 nodes) */
const fogFunctions = new Map<string, (inputs: FogInputs) => Node>();
function fogFunction(name: string, inputs: Layout, body: (inputs: FogInputs) => Node): (inputs: FogInputs) => Node {
  let fn = fogFunctions.get(name);
  if (fn === undefined) { fn = Fn<FogInputs, Node>(body).setLayout({ name, type: 'vec3', inputs }); fogFunctions.set(name, fn); }
  return fn;
}
const FOG_TERMS: Layout = [{ name: 'colour', type: 'vec3' }, { name: 'position', type: 'vec3' }, { name: 'camera', type: 'vec3' }, { name: 'fogColour', type: 'vec3' },
  { name: 'heightFalloff', type: 'float' }, { name: 'height', type: 'float' }, { name: 'heightDensity', type: 'float' }, { name: 'distDensity', type: 'float' },
  { name: 'sunDir', type: 'vec3' }, { name: 'sunColour', type: 'vec3' }];

/** the engine fog's body (the chunk's maths in its order) over a layout function's inputs, for one variant */
function engineFogBody(edgeHaze: boolean, weather: boolean, scaled: boolean): (inputs: FogInputs) => Node {
  return (inputs: FogInputs): Node => {
    const position = vec3In(inputs, 'position'), camera = vec3In(inputs, 'camera');
    const ray = position.sub(camera);
    const rayLen = length(ray);
    const viewDir = ray.div(max(rayLen, 1e-3));
    // exponential height fog integrated along the view ray (Unreal-style)
    const dy = position.y.sub(camera.y);
    const falloff = fl(inputs, 'heightFalloff');
    const camF = exp(falloff.negate().mul(camera.y.sub(fl(inputs, 'height'))));
    const t = falloff.mul(dy);
    const integ = select(abs(t).greaterThan(1e-3), float(1).sub(exp(t.negate())).div(t), float(1));
    const heightAmt = fl(inputs, 'heightDensity').mul(camF).mul(integ).mul(rayLen);
    const distAmt = fl(inputs, 'distDensity').mul(rayLen);
    let factor: Node<'float'> = clamp(float(1).sub(exp(heightAmt.add(distAmt).negate())), 0, 1);
    if (edgeHaze) {
      // the slab's last metres thicken into the painted horizon's haze, seen from above (PH-L5)
      const edge = vec4In(inputs, 'edge');
      const edgeD = max(abs(position.x), abs(position.z));
      const fogE = edge.x.mul(smoothstep(edge.y, edge.z, edgeD)).mul(smoothstep(edge.w, edge.w.mul(4), camera.y.sub(position.y)));
      factor = float(1).sub(float(1).sub(factor).mul(float(1).sub(fogE)));
      // the Ghost Stag's fog bank (PH-C7)
      const blob = vec4In(inputs, 'blob');
      const fogB = fl(inputs, 'blobAmount').mul(float(1).sub(smoothstep(0.1, 1, length(position.sub(blob.xyz)).div(blob.w)))).mul(smoothstep(5, 24, rayLen));
      factor = float(1).sub(float(1).sub(factor).mul(float(1).sub(fogB)));
    }
    const sunAmt = max(dot(viewDir, vec3In(inputs, 'sunDir')), 0);
    const fogCol = mix(vec3In(inputs, 'fogColour'), vec3In(inputs, 'sunColour'), pow(sunAmt, 6).mul(0.7));
    const scale = scaled ? fl(inputs, 'scale') : null;
    if (scale !== null) factor = factor.mul(clamp(scale, 0, 1));
    let rgb = mix(vec3In(inputs, 'colour'), fogCol, factor);
    if (weather) {
      // the weather fog (E390), over the level's own fog
      const w = vec4In(inputs, 'weather');
      const wAmt = w.x.add(w.y.mul(camF).mul(integ)).mul(rayLen);
      const weatherFactor = clamp(float(1).sub(exp(wAmt.negate())).mul(w.z), 0, 1);
      rgb = mix(rgb, vec3In(inputs, 'weatherColour'), scale === null ? weatherFactor : weatherFactor.mul(clamp(scale, 0, 1)));
    }
    return rgb;
  };
}

/** Optional interpolated scale attenuates both scene and weather blends; absent is neutral.
 * fog `out` (a colour after the output transform) the way Atmosphere.ts's chunk fogs a classic material; unfogged when the scene has no fog (USE_FOG off).
 * One shared layout function per variant (`wsEngineFog…`), its inputs the engine's uniform objects by reference. */
export function engineFog(out: Node<'vec4'>, fog: THREE.Fog | THREE.FogExp2 | null, scale?: Node<'float'>): Node<'vec4'> {
  if (fog === null) return out;
  const terms = atmosphereTerms(), u = fogUniforms, scaled = scale !== undefined;
  const name = `wsEngineFog${terms.edgeHaze ? 'E' : ''}${terms.weather ? 'W' : ''}${scaled ? 'S' : ''}`;
  const layout: Layout = [...FOG_TERMS,
    ...terms.edgeHaze ? [{ name: 'edge', type: 'vec4' }, { name: 'blob', type: 'vec4' }, { name: 'blobAmount', type: 'float' }] : [],
    ...scaled ? [{ name: 'scale', type: 'float' }] : [],
    ...terms.weather ? [{ name: 'weather', type: 'vec4' }, { name: 'weatherColour', type: 'vec3' }] : []];
  const args: Record<string, Node> = { colour: out.rgb, position: positionWorld, camera: cameraPosition, fogColour: reference('color', 'color', fog), // classic three's `fogColor`
    heightFalloff: f(u.fogHeightFalloff), height: f(u.fogHeight), heightDensity: f(u.fogHeightDensity), distDensity: f(u.fogDistDensity),
    sunDir: v3(u.fogSunDir), sunColour: col(u.fogSunColor) };
  if (terms.edgeHaze) { args['edge'] = v4(u.fogEdge); args['blob'] = v4(weatherUniforms.fogBlob); args['blobAmount'] = f(weatherUniforms.fogBlobAmt); }
  if (scale !== undefined) args['scale'] = scale;
  if (terms.weather) { args['weather'] = v4(weatherFogUniforms.fogWeather); args['weatherColour'] = col(weatherFogUniforms.fogWeatherColor); }
  const rgb = fogFunction(name, layout, engineFogBody(terms.edgeHaze, terms.weather, scaled))(args);
  return vec4(new ConvertNode<'vec3'>(rgb, 'vec3'), out.a);
}

const RAMP_TERMS: Layout = [{ name: 'colour', type: 'vec3' }, { name: 'position', type: 'vec3' }, { name: 'camera', type: 'vec3' }, { name: 'fogColour', type: 'vec3' },
  { name: 'heightFalloff', type: 'float' }, { name: 'height', type: 'float' }, { name: 'heightDensity', type: 'float' }, { name: 'distDensity', type: 'float' },
  { name: 'start', type: 'float' }, { name: 'end', type: 'float' }, { name: 'near', type: 'vec3' }, { name: 'zenith', type: 'vec3' },
  { name: 'sunColour', type: 'vec3' }, { name: 'sunDir', type: 'vec3' }];
function colourRampBody(scaled: boolean): (inputs: FogInputs) => Node {
  return (inputs: FogInputs): Node => {
    const position = vec3In(inputs, 'position'), camera = vec3In(inputs, 'camera');
    const fogColor = vec3In(inputs, 'fogColour');
    const ray = position.sub(camera), rayLen = length(ray), viewDir = ray.div(max(rayLen, 1e-3));
    const falloff = fl(inputs, 'heightFalloff'), dy = position.y.sub(camera.y);
    const camF = exp(falloff.negate().mul(camera.y.sub(fl(inputs, 'height'))));
    const t = falloff.mul(dy);
    const integ = select(abs(t).greaterThan(1e-3), float(1).sub(exp(t.negate())).div(t), float(1));
    const expF = clamp(float(1).sub(exp(fl(inputs, 'heightDensity').mul(camF).mul(integ).mul(rayLen).add(fl(inputs, 'distDensity').mul(rayLen)).negate())), 0, 1);
    const r = smoothstep(fl(inputs, 'start'), fl(inputs, 'end'), rayLen);
    const rampF = pow(r, 0.8).mul(mix(1, 0.72, smoothstep(4, 40, position.y)));
    const sky = mix(fogColor, vec3In(inputs, 'zenith'), pow(smoothstep(0, 0.75, max(viewDir.y, 0)), 0.62));
    let colour = mix(vec3In(inputs, 'near'), sky, smoothstep(0, 0.55, r));
    colour = colour.add(vec3In(inputs, 'sunColour').mul(pow(max(dot(viewDir, vec3In(inputs, 'sunDir')), 0), 8)).mul(0.3).mul(r));
    colour = mix(colour, fogColor, clamp(expF.sub(rampF).mul(4), 0, 1));
    const factor = max(rampF, expF);
    return mix(vec3In(inputs, 'colour'), colour, scaled ? factor.mul(clamp(fl(inputs, 'scale'), 0, 1)) : factor);
  };
}

/** A level's live near-to-zenith colour ramp over the integrated height/distance fog.
 * Borrowed tunables keep day, underwater and map-capture updates on the existing owner. One shared layout function per
 * variant (`wsColourRampFog…`). */
export function colourRampFog(out: Node<'vec4'>, context: NodeFogContext, ramp: NodeFogColourRamp): Node<'vec4'> {
  if (ramp.panorama !== undefined) return panoramaFog(out, context, ramp.panorama);
  const u = fogUniforms, scaled = context.scale !== undefined;
  const name = `wsColourRampFog${scaled ? 'S' : ''}`;
  const args: Record<string, Node> = { colour: out.rgb, position: context.position, camera: context.camera, fogColour: reference('color', 'color', context.fog),
    heightFalloff: f(u.fogHeightFalloff), height: f(u.fogHeight), heightDensity: f(u.fogHeightDensity), distDensity: f(u.fogDistDensity),
    start: f(ramp.start), end: f(ramp.end), near: col(ramp.near), zenith: col(ramp.zenith), sunColour: col(u.fogSunColor), sunDir: v3(u.fogSunDir) };
  if (context.scale !== undefined) args['scale'] = context.scale;
  const rgb = fogFunction(name, scaled ? [...RAMP_TERMS, { name: 'scale', type: 'float' }] : RAMP_TERMS, colourRampBody(scaled))(args);
  return vec4(new ConvertNode<'vec3'>(rgb, 'vec3'), out.a);
}

/** A painted world's panorama haze (Atmosphere.ts's panorama chunk as nodes): the aerial haze thinning with height, the
 *  integrated height fog and the edge haze, coloured by the heading LUT under its live re-grade. The LUT is read at build. */
function panoramaFog(out: Node<'vec4'>, context: NodeFogContext, panorama: NodeFogPanorama): Node<'vec4'> {
  const u = fogUniforms, position = context.position, camera = context.camera, tint = panorama.tint;
  const ray = position.sub(camera), rayLen = length(ray), viewDir = ray.div(max(rayLen, 1e-3));
  const aerial = v4(panorama.aerial), edge = v4(panorama.edge);
  const dens = aerial.x.add(max(f(u.fogDistDensity).sub(aerial.w), 0));
  const aer = max(rayLen.sub(aerial.y), 0).mul(dens).mul(exp(max(position.y.add(camera.y).mul(0.5).sub(aerial.z), 0).mul(-0.035)));
  const falloff = f(u.fogHeightFalloff), dy = position.y.sub(camera.y);
  const camF = exp(falloff.negate().mul(camera.y.sub(f(u.fogHeight))));
  const t = falloff.mul(dy);
  const integ = select(abs(t).greaterThan(1e-3), float(1).sub(exp(t.negate())).div(t), float(1));
  const height = clamp(float(1).sub(exp(aer.add(f(u.fogHeightDensity).mul(camF).mul(integ).mul(rayLen)).negate())), 0, 1);
  const edgeD = max(abs(position.x), abs(position.z));
  const fe = edge.x.mul(smoothstep(edge.y, edge.z, edgeD)).mul(smoothstep(edge.w, edge.w.mul(3), rayLen));
  let factor: Node<'float'> = float(1).sub(float(1).sub(height).mul(float(1).sub(fe)));
  const heading = new MathNode('atan', viewDir.x.negate());
  heading.bNode = viewDir.z;
  let haze: Node<'vec3'> = texture(panorama.lut.value, vec2(new ConvertNode<'float'>(heading, 'float').mul(0.15915494), 0.5)).rgb.mul(col(tint.key));
  const lum = dot(haze, vec3(0.2126, 0.7152, 0.0722));
  haze = mix(haze, lum.mul(vec3(0.5, 0.62, 1)), f(tint.moon).mul(0.8)).mul(col(tint.light));
  haze = mix(haze, col(tint.veilColour), f(tint.veil)).add(lum.mul(f(tint.flash)).mul(vec3(0.8, 0.85, 1)));
  if (context.scale !== undefined) factor = factor.mul(clamp(context.scale, 0, 1));
  return vec4(mix(out.rgb, haze, factor), out.a);
}
