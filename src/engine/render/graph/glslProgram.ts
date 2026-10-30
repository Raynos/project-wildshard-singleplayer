/**
 * A lowered material graph (`glsl.ts`) as a classic three program (nine-fix NF13): `graphShaders(glsl)` wraps the graph's
 * statements in three's own chunks (instancing, batching, skinning, morphs, clipping, log depth, shadow coordinates, fog
 * and, for a lit graph, the physical light model) and returns the vertex and fragment source with their uniforms, so
 * `graphShaderMaterial(glsl)` is a plain `ShaderMaterial` that `WebGLRenderer` compiles and draws with no node runtime.
 *
 * - **Instances, as the node path:** `wsPositionLocal` / `wsNormalLocal` already carry the instance (or batch) transform,
 *   as an instanced node mesh's `positionLocal` does, so the graph's offset is added after it and the projection does not
 *   apply it again.
 * - **The lighting stage** runs inside three's physical light loops: `RE_Direct` becomes `wsGraphDirect`, which hands a
 *   directional light (the sky rig's cascades are one sun) to `wsGraphSun` with its unshadowed colour and shadow ratio
 *   and keeps the physical term for every other light; `RE_IndirectDiffuse` becomes the graph's ambient; the grade runs on
 *   the lit colour before the output transform (a graded material is not tone mapped).
 * - **Output:** an unlit graph writes raw colour (no tone mapping, no colour-space step), as the GLSL programs it stands
 *   for did; `effectState.output: 'colour'` applies the target's encoding. Fog is the engine's chunk after it, scaled by
 *   `vertex.scale.fog`, or a declared fog graph's `wsGraphFog` in its place.
 *
 * Every uniform name a graph reads is in the returned `uniforms`; a host feeds the `from: 'host'` ones (`glsl.uniforms`).
 */
import * as THREE from 'three';
import { parseFamilyMaterial } from '@wildshard/format/materialFamilies';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { emitGraphGlsl, glslFloat, type EmitGraphGlslOptions, type GraphGlsl, type GraphGlslProgram, type GraphGlslUniform } from './glsl';
import { toonGraph } from './presets';
import type { ToonLook } from '../families/toon';
import { windUniforms } from '../../world/wind';
import { fogUniforms } from '../../world/Atmosphere';

/** the toon preset's params, read from the family's own uniforms (`ToonLook.uniforms`) */
const TOON_PARAMS: NonNullable<EmitGraphGlslOptions['toon']>['params'] = {
  face: { uniform: 'famToonFace', type: 'vec2' }, shadowEdge: { uniform: 'famToonShadow', type: 'vec2' }, grade: { uniform: 'famToonGrade', type: 'vec2' },
  lift: { uniform: 'famToonLift', type: 'vec3' }, rim: { uniform: 'famToonRim', type: 'vec3' }, terminator: { uniform: 'famToonTerm', type: 'vec3' },
  gloss: { uniform: 'famToonGloss', type: 'float' }, cloud: { uniform: 'famToonCloud', type: 'vec4' }, cloudTime: { uniform: 'famToonTime', type: 'float' },
  water: { uniform: 'famToonWater', type: 'vec2' },
};
/** the `toon` option for a `model: 'toon'` graph: the family's preset for this look (without caustics when the graph says so) */
export function glslToon(look: ToonLook, caustics = true): NonNullable<EmitGraphGlslOptions['toon']> {
  const row = parseFamilyMaterial({ family: 'toon' });
  if (row.family !== 'toon') throw new Error('material graph: the toon family row is missing');
  const params = caustics ? look.params : { ...look.params, caustics: { ...look.params.caustics, level: null } };
  return { preset: toonGraph(row, params), params: TOON_PARAMS };
}
/** lower a graph for the classic back-end, a toon graph with the family's preset */
export function emitClassicGraph(input: unknown, opts: Omit<EmitGraphGlslOptions, 'toon'> & { readonly toonLook?: ToonLook } = {}): GraphGlsl {
  const model: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, 'model') : undefined;
  const caustics: unknown = typeof input === 'object' && input !== null ? Reflect.get(input, 'toonCaustics') : undefined;
  const { toonLook, ...rest } = opts;
  if (model !== 'toon') return emitGraphGlsl(input, rest);
  if (toonLook === undefined) throw new Error('material graph: a toon graph needs its ToonLook');
  return emitGraphGlsl(input, { ...rest, toon: glslToon(toonLook, caustics !== false), replaceEnvironmentDiffuse: true });
}

/** a classic program's sources and uniforms */
export interface GraphShaders {
  readonly vertexShader: string;
  readonly fragmentShader: string;
  readonly uniforms: Record<string, THREE.IUniform>;
  /** the program reads the scene's lights (a lit graph): a ShaderMaterial with `lights: true` */
  readonly lights: boolean;
  /** the program applies the engine's fog chunk (`fog: true`) */
  readonly fog: boolean;
}
/** what wrapping a graph needs beyond its lowering */
export interface GraphShaderOptions {
  /** the outline's hull program instead of the main draw */
  readonly outline?: boolean;
  /** a declared fog graph (`effectState.fog: '<id>'`) lowered by `emitGraphGlsl`: its `wsGraphFog` replaces the engine fog */
  readonly fog?: GraphGlsl;
  /** the toon family's uniforms (a toon graph reads them) */
  readonly toonLook?: ToonLook;
  /** resolve an admitted texture param's file (a lent param starts on a 1×1 stand-in) */
  readonly textures?: (ref: string, role?: 'colour' | 'data') => THREE.Texture;
}

const isUniform = (v: unknown): v is THREE.IUniform => typeof v === 'object' && v !== null && 'value' in v;
const decl = (u: GraphGlslUniform): string => (u.from === 'array' ? `uniform ${u.type} ${u.name}[${String(u.length)}];` : `uniform ${u.type} ${u.name};`);
/** the host helpers both stages read (instance transform, instance and vertex colour, skin direction, the frame camera) */
const VERTEX_HELPERS = `vec4 wsInstanceTransform( vec4 v ) {
#ifdef USE_BATCHING
  v = getBatchingMatrix( getIndirectIndex( gl_DrawID ) ) * v;
#endif
#ifdef USE_INSTANCING
  v = instanceMatrix * v;
#endif
  return v;
}
vec3 wsInstanceColour() {
#if defined( USE_INSTANCING_COLOR )
  return instanceColor;
#elif defined( USE_BATCHING_COLOR )
  return getBatchingColor( getIndirectIndex( gl_DrawID ) ).rgb;
#else
  return vec3( 1.0 );
#endif
}
vec4 wsVertexColour() {
#if defined( USE_COLOR_ALPHA )
  return color;
#elif defined( USE_COLOR )
  return vec4( color, 1.0 );
#else
  return vec4( 1.0 );
#endif
}
#ifdef USE_SKINNING
#define wsSkinDirection( d ) ( mat3( skinMatrix ) * ( d ) )
#else
#define wsSkinDirection( d ) ( d )
#endif`;
/** the camera the graph reads: a layered backdrop's frame (G321) defines its own before this */
const FRAME = `#ifndef wsFrameCamera
#define wsFrameCamera cameraPosition
#endif
#ifndef wsFrameView
#define wsFrameView viewMatrix
#endif`;

/** the vertex stage: three's deformations, the graph's own, then the projection without the instance transform again */
function vertexShader(glsl: GraphGlsl, program: GraphGlslProgram, uniforms: string, lit: boolean, fogged: boolean, outline: boolean): string {
  const o = program.outputs;
  const attributes = glsl.attributes.map(a => `attribute ${a.type} ${a.name};`).join('\n');
  const position = o.position !== null ? `transformed = ${o.position};`
    : o.offset !== null ? `transformed = wsPositionLocal + ${o.offset} / wsCodecStep;` : 'transformed = wsPositionLocal;';
  return `#define WS_GRAPH
#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
${lit ? '#include <shadowmap_pars_vertex>\nvarying vec3 vViewPosition;\n#ifndef FLAT_SHADED\nvarying vec3 vNormal;\n#endif' : ''}
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
uniform float wsCodecStep;
${uniforms}
${attributes}
${VERTEX_HELPERS}
${FRAME}
${fogged ? 'varying vec3 wsVFogWorld;' : ''}
${program.vertex.head}
void main() {
#include <morphinstance_vertex>
#include <batching_vertex>
#include <beginnormal_vertex>
#include <morphnormal_vertex>
#include <skinbase_vertex>
#include <skinnormal_vertex>
#include <begin_vertex>
#include <morphtarget_vertex>
#include <skinning_vertex>
  vec3 wsPositionLocal = wsInstanceTransform( vec4( transformed, 1.0 ) ).xyz;
  vec3 wsNormalLocal = objectNormal;
#ifdef USE_BATCHING
  mat3 wsBm = mat3( batchingMatrix );
  wsNormalLocal = wsBm * ( wsNormalLocal / vec3( dot( wsBm[ 0 ], wsBm[ 0 ] ), dot( wsBm[ 1 ], wsBm[ 1 ] ), dot( wsBm[ 2 ], wsBm[ 2 ] ) ) );
#endif
#ifdef USE_INSTANCING
  mat3 wsIm = mat3( instanceMatrix );
  wsNormalLocal = wsIm * ( wsNormalLocal / vec3( dot( wsIm[ 0 ], wsIm[ 0 ] ), dot( wsIm[ 1 ], wsIm[ 1 ] ), dot( wsIm[ 2 ], wsIm[ 2 ] ) ) );
#endif
${program.vertex.body}
  ${position}
${o.normal !== null && !outline ? `  wsNormalLocal = wsInstanceTransform( vec4( ${o.normal}, 0.0 ) ).xyz;` : ''}
  vec4 wsWorldPosition = modelMatrix * vec4( transformed, 1.0 );
  vec4 mvPosition = viewMatrix * wsWorldPosition;
  gl_Position = ${o.clip ?? 'projectionMatrix * mvPosition'};
${o.pointSize !== null ? `  gl_PointSize = clamp( ${o.pointSize}, 1.0, 2048.0 );` : ''}
#include <logdepthbuf_vertex>
#include <clipping_planes_vertex>
${lit ? `  vec3 transformedNormal = normalMatrix * wsNormalLocal;
#ifdef FLIP_SIDED
  transformedNormal = - transformedNormal;
#endif
#ifndef FLAT_SHADED
  vNormal = normalize( transformedNormal );
#endif
  vViewPosition = - mvPosition.xyz;
  vec4 worldPosition = wsWorldPosition;
#include <shadowmap_vertex>` : ''}
#include <fog_vertex>
${fogged ? '  wsVFogWorld = wsWorldPosition.xyz;' : ''}
${program.vertex.end}
}`;
}

/** the fog epilogue: the engine's chunk (scaled by the graph's fog share), or a declared fog graph in its place */
function fogEpilogue(program: GraphGlslProgram, fog: GraphGlsl | undefined): string {
  const scale = program.outputs.fogScale ?? '1.0';
  if (fog !== undefined) return `  vec3 wsBeforeFog = gl_FragColor.rgb;
#include <fog_fragment>
  gl_FragColor.rgb = wsGraphFog( wsBeforeFog, gl_FragColor.rgb, wsVFogWorld, cameraPosition, ${scale} );`;
  if (program.outputs.fogScale === null) return '#include <fog_fragment>';
  return `  vec3 wsBeforeFog = gl_FragColor.rgb;
#include <fog_fragment>
  gl_FragColor.rgb = mix( wsBeforeFog, gl_FragColor.rgb, ${scale} );`;
}

/** an unlit graph's fragment stage */
function unlitFragment(glsl: GraphGlsl, program: GraphGlslProgram, uniforms: string, fogged: boolean, fog: GraphGlsl | undefined): string {
  const o = program.outputs, ir = glsl.ir, s = ir.stages.surface;
  const cutoff = s?.alphaCutoff === undefined ? '' : `  if ( diffuseColor.a < ${glslFloat(s.alphaCutoff)} ) discard;`;
  const alpha = o.targetAlpha ?? (ir.effectState?.output === 'colour' ? '1.0' : 'diffuseColor.a');
  return `#define WS_GRAPH
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
${uniforms}
${FRAME}
${fogged ? 'varying vec3 wsVFogWorld;' : ''}
${fog?.fog ?? ''}
${program.fragment.head}
void main() {
#include <clipping_planes_fragment>
#include <logdepthbuf_fragment>
${program.fragment.body}
${o.discard !== null ? `  if ( ${o.discard} ) discard;` : ''}
  vec4 diffuseColor = vec4( ${o.colour ?? 'wsMaterialColour'}, ${o.alpha ?? '1.0'} );
${cutoff}
  gl_FragColor = vec4( diffuseColor.rgb, ${alpha} );
${ir.effectState?.output === 'colour' ? '#include <colorspace_fragment>' : ''}
${fogged ? fogEpilogue(program, fog) : ''}
#include <premultiplied_alpha_fragment>
}`;
}

/** a lit graph's fragment stage: three's physical model, its light equations the graph's where it has a lighting stage */
function litFragment(glsl: GraphGlsl, program: GraphGlslProgram, uniforms: string, fogged: boolean, fog: GraphGlsl | undefined, replaceEnvironmentDiffuse: boolean): string {
  const o = program.outputs, ir = glsl.ir, s = ir.stages.surface, l = program.lighting;
  const cutoff = s?.alphaCutoff === undefined ? '' : `  if ( diffuseColor.a < ${glslFloat(s.alphaCutoff)} ) discard;`;
  const sunScale = o.sunScale;
  const direct = l === null && sunScale === null ? '' : `bool wsDirectional = false;
vec3 wsDirectionalBase = vec3( 0.0 );
#if NUM_DIR_LIGHTS > 0
void wsGetDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
  getDirectionalLightInfo( directionalLight, light ); wsDirectional = true; wsDirectionalBase = light.color;
}
#define getDirectionalLightInfo wsGetDirectionalLightInfo
#endif
#if NUM_SUN_LIGHTS > 0
void wsGetSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
  getSunLightInfo( sunLight, light ); wsDirectional = true; wsDirectionalBase = light.color;
}
#define getSunLightInfo wsGetSunLightInfo
#endif
#if NUM_POINT_LIGHTS > 0
void wsGetPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
  getPointLightInfo( pointLight, geometryPosition, light ); wsDirectional = false;
}
#define getPointLightInfo wsGetPointLightInfo
#endif
#if NUM_SPOT_LIGHTS > 0
void wsGetSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
  getSpotLightInfo( spotLight, geometryPosition, light ); wsDirectional = false;
}
#define getSpotLightInfo wsGetSpotLightInfo
#endif
/** three's physical direct term, its diffuse and / or its specular */
void wsDirectPhysical( const in IncidentLight directLight, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in PhysicalMaterial material, inout ReflectedLight reflectedLight, const in bool diffuse, const in bool specular ) {
  float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
  vec3 irradiance = dotNL * directLight.color;
  if ( specular ) reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material ) * material.multiScatteringCompensation;
  if ( diffuse ) {
    vec3 halfDir = normalize( directLight.direction + geometryViewDir );
    vec3 F = F_Schlick( material.specularColor, material.specularF90, saturate( dot( geometryViewDir, halfDir ) ) );
    reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
  }
}
void wsGraphDirect( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float scale = ${sunScale ?? '1.0'};
  if ( ! wsDirectional ) { wsDirectPhysical( directLight, geometryNormal, geometryViewDir, material, reflectedLight, true, ${l === null || l.specular ? 'true' : 'false'} ); return; }
${l === null ? `  IncidentLight scaled = directLight; scaled.color *= scale;
  wsDirectPhysical( scaled, geometryNormal, geometryViewDir, material, reflectedLight, true, true );` : `  vec3 base = wsDirectionalBase;
  float shadow = clamp( dot( directLight.color, vec3( 1.0 ) ) / max( dot( base, vec3( 1.0 ) ), 1e-5 ), 0.0, 1.0 );
  vec4 sun = wsGraphSun( directLight.direction, base, shadow );
  reflectedLight.directDiffuse += sun.xyz * scale;
${l.specular ? `  IncidentLight specular = directLight; specular.color = base * sun.w * scale;
  wsDirectPhysical( specular, geometryNormal, geometryViewDir, material, reflectedLight, false, true );` : ''}`}
}
#undef RE_Direct
#define RE_Direct wsGraphDirect`;
  const ambient = l?.ambient === true
    ? `#undef RE_IndirectDiffuse
#define RE_IndirectDiffuse( irr, gp, gn, gv, gc, mat, rl ) rl.indirectDiffuse += wsGraphAmbient( irr, ${l.ownsEnvironment ? 'radiance, iblIrradiance' : 'vec3( 0.0 ), vec3( 0.0 )'} )` : '';
  // the environment's specular runs only for a material that keeps a specular and does not own the environment itself
  const indirectSpecular = l === null ? '' : !l.specular || l.ownsEnvironment
    ? '#undef RE_IndirectSpecular\n#define RE_IndirectSpecular( r, i, c, gp, gn, gv, gc, mat, rl )'
    : replaceEnvironmentDiffuse && l.ambient
      ? '#undef RE_IndirectSpecular\n#define RE_IndirectSpecular( r, i, c, gp, gn, gv, gc, mat, rl ) RE_IndirectSpecular_Physical( r, vec3( 0.0 ), c, gp, gn, gv, gc, mat, rl )'
      : '';
  const occlusion = o.occlusion === null ? '' : `  float ambientOcclusion = ${o.occlusion};
  reflectedLight.indirectDiffuse *= ambientOcclusion;
#if defined( USE_ENVMAP ) && defined( STANDARD )
  reflectedLight.indirectSpecular *= computeSpecularOcclusion( saturate( dot( geometryNormal, geometryViewDir ) ), ambientOcclusion, material.roughness );
#endif`;
  return `#define WS_GRAPH
#define STANDARD
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <shadowmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
${uniforms}
${FRAME}
${fogged ? 'varying vec3 wsVFogWorld;' : ''}
${fog?.fog ?? ''}
vec3 wsNormalView;
vec3 wsViewDirection;
vec3 wsAlbedo;
float wsRoughness;
vec3 wsEnvironmentIrradianceAt( vec3 direction ) {
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
  return PI * textureCubeUV( envMap, envMapRotation * direction, 1.0 ).rgb * envMapIntensity;
#else
  return vec3( 0.0 );
#endif
}
${program.fragment.head}
${direct}
${ambient}
${indirectSpecular}
void main() {
#include <clipping_planes_fragment>
#include <logdepthbuf_fragment>
${program.fragment.body}
${o.discard !== null ? `  if ( ${o.discard} ) discard;` : ''}
  vec4 diffuseColor = vec4( ${o.colour ?? 'wsMaterialColour'}, ${o.alpha ?? '1.0'} );
${cutoff}
  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  vec3 totalEmissiveRadiance = ${o.emissive ?? 'vec3( 0.0 )'};
  float roughnessFactor = ${o.roughness ?? '1.0'};
  float metalnessFactor = ${o.metalness ?? '0.0'};
#include <normal_fragment_begin>
${ir.flipBackfaceNormals === false ? '#ifdef DOUBLE_SIDED\n  normal *= faceDirection;\n#endif' : ''}
${o.shadingNormal !== null ? `  normal = normalize( ( viewMatrix * vec4( ${o.shadingNormal}, 0.0 ) ).xyz );` : ''}
#include <lights_physical_fragment>
  wsNormalView = normal;
  wsViewDirection = ( isOrthographic ) ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
  wsAlbedo = material.diffuseContribution;
  wsRoughness = material.roughness;
#include <lights_fragment_begin>
#include <lights_fragment_maps>
#include <lights_fragment_end>
${occlusion}
  vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
  vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
  vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
${l?.grade === true ? '  outgoingLight = wsGraphGrade( outgoingLight );' : ''}
#include <opaque_fragment>
${o.targetAlpha !== null ? `  gl_FragColor.a = ${o.targetAlpha};` : ''}
${l?.grade === true ? '' : '#include <tonemapping_fragment>'}
#include <colorspace_fragment>
${fogged ? fogEpilogue(program, fog) : ''}
#include <premultiplied_alpha_fragment>
#include <dithering_fragment>
}`;
}

/** a post graph's pass: a fullscreen triangle over the scene, the graph's colour faded over it by `wsWeight` */
function postShaders(program: GraphGlslProgram, uniforms: string): { vertexShader: string; fragmentShader: string } {
  const colour = program.outputs.colour ?? 'vec3( 0.0 )';
  const varyingUv = program.vertex.body.includes('wsVUv') ? '' : 'varying vec2 wsVUv;';
  return {
    vertexShader: `#define WS_GRAPH
${uniforms}
${varyingUv}
${program.vertex.head}
void main() {
${program.vertex.body}
${varyingUv === '' ? '' : '  wsVUv = uv;'}
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}`,
    fragmentShader: `#define WS_GRAPH
#include <common>
#include <packing>
${uniforms}
${varyingUv}
${program.fragment.head}
void main() {
${program.fragment.body}
  gl_FragColor = vec4( mix( texture( wsScene, wsVUv ).rgb, ${colour}, wsWeight ), ${program.outputs.alpha ?? '1.0'} );
}`,
  };
}

/** a uniform's starting value: a param's own (a colour held linear, as the families hold theirs), an engine clock or light
 *  shared by reference, a texture its resolver admits, else a neutral value the host moves */
function uniformValue(glsl: GraphGlsl, u: GraphGlslUniform, opts: GraphShaderOptions): THREE.IUniform {
  const vector = (type: 'float' | 'vec2' | 'vec3' | 'vec4', v: GraphLiteral): number | THREE.Vector2 | THREE.Vector3 | THREE.Vector4 => {
    const a = typeof v === 'number' ? [v] : v;
    return type === 'float' ? a[0] ?? 0 : type === 'vec2' ? new THREE.Vector2().fromArray(a) : type === 'vec3' ? new THREE.Vector3().fromArray(a) : new THREE.Vector4().fromArray(a);
  };
  switch (u.from) {
    case 'param': {
      const p = glsl.ir.params?.[u.param];
      if (p === undefined || typeof p.value === 'string') return { value: 0 };
      if (p.type === 'colour') { const [r = 0, g = 0, b = 0] = typeof p.value === 'number' ? [p.value] : p.value; return { value: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace) }; }
      return { value: vector(u.type, p.value) };
    }
    case 'array': return { value: (glsl.ir.arrays?.[u.param]?.value ?? []).map(v => vector(u.type, v)) };
    case 'texture': {
      const p = glsl.ir.params?.[u.param];
      if (p === undefined || typeof p.value !== 'string' || p.role === 'lent' || opts.textures === undefined) return { value: null };
      return { value: p.role === undefined ? opts.textures(p.value) : opts.textures(p.value, p.role) };
    }
    case 'toon': {
      // the family's own uniform object, shared by reference: the look's day clock moves every toon program at once
      const own: unknown = opts.toonLook === undefined ? undefined : Reflect.get(opts.toonLook.uniforms, u.toon);
      if (isUniform(own)) return own;
      return { value: u.type === 'float' ? 0 : vector(u.type, Array.from({ length: u.type === 'vec2' ? 2 : u.type === 'vec3' ? 3 : 4 }, () => 0)) };
    }
    case 'host':
      switch (u.host) {
        case 'windTime': return windUniforms.uWindTime;
        case 'windGust': return windUniforms.uGust;
        case 'atmosphereSunDirection': return fogUniforms.fogSunDir;
        case 'atmosphereSunColour': return fogUniforms.fogSunColor;
        case 'codecStep': case 'weight': return { value: 1 };
        case 'cameraNear': case 'depthNear': return { value: 0.1 };
        case 'depthFar': return { value: 1000 };
        case 'time': return { value: 0 };
        case 'materialColour': return { value: new THREE.Color(1, 1, 1) };
        case 'screenSize': return { value: new THREE.Vector2(1, 1) };
        case 'scene': case 'depth': case 'normal': case 'meshMap': case 'bumpMap': return { value: null };
        case 'codecOrigin': case 'fogColour': case 'fogZenithColour': case 'materialEmissive': case 'skyLightColour': case 'skyLightDirection': return { value: new THREE.Vector3() };
        default: throw new Error('material graph: an unknown host uniform');
      }
    default: throw new Error('material graph: an unknown uniform source');
  }
}

/** Wrap a lowered graph in a classic program: the main draw (a material or a post pass), or its outline hull. */
export function graphShaders(glsl: GraphGlsl, opts: GraphShaderOptions = {}): GraphShaders {
  const program = opts.outline === true ? glsl.outline : glsl.program;
  if (program === null) throw new Error(opts.outline === true ? 'material graph: no outline stage' : 'material graph: a fog graph has no program of its own');
  const all = [...glsl.uniforms, ...(opts.fog?.uniforms ?? [])];
  const seen = new Set<string>(), own = all.filter(u => (seen.has(u.name) ? false : (seen.add(u.name), true)));
  // the codec step and material colour every mesh program reads, declared once whether or not the graph names them
  const declared = own.filter(u => u.name !== 'wsCodecStep').map(decl);
  if (!seen.has('wsMaterialColour')) { own.push({ name: 'wsMaterialColour', type: 'vec3', from: 'host', host: 'materialColour' }); declared.push('uniform vec3 wsMaterialColour;'); }
  if (!seen.has('wsCodecStep')) own.push({ name: 'wsCodecStep', type: 'float', from: 'host', host: 'codecStep' });
  const uniforms: Record<string, THREE.IUniform> = {};
  for (const u of own) uniforms[u.name] = uniformValue(opts.fog !== undefined && opts.fog.uniforms.includes(u) ? opts.fog : glsl, u, opts);
  const text = declared.join('\n'), ir = glsl.ir;
  if (ir.kind === 'post') {
    // a pass fades over the scene by its stack's owner weight (the engine's blend): one more tap of the colour input
    const extra = [...(seen.has('wsScene') ? [] : [{ name: 'wsScene', type: 'sampler2D', from: 'host', host: 'scene' } as const]),
      ...(seen.has('wsWeight') ? [] : [{ name: 'wsWeight', type: 'float', from: 'host', host: 'weight' } as const])];
    for (const u of extra) uniforms[u.name] = uniformValue(glsl, u, opts);
    return { ...postShaders(program, [text, ...extra.map(decl)].join('\n')), uniforms, lights: false, fog: false };
  }
  const outline = opts.outline === true, lit = !outline && ir.model !== 'unlit';
  const fogged = outline || ir.effectState?.fog !== false;
  const declaredFog = fogged && opts.fog !== undefined;
  if (lit) Object.assign(uniforms, THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.envmap]), { ...uniforms });
  if (fogged) Object.assign(uniforms, THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { ...uniforms });
  return {
    vertexShader: vertexShader(glsl, program, text, lit, declaredFog, outline),
    fragmentShader: lit ? litFragment(glsl, program, text, fogged, declaredFog ? opts.fog : undefined, glsl.ir.model === 'toon')
      : unlitFragment(glsl, program, text, fogged, declaredFog ? opts.fog : undefined),
    uniforms, lights: lit, fog: fogged,
  };
}

/** A graph as a classic `ShaderMaterial` with the graph's render state (sides, blend, depth, flat shading, points). */
export function graphShaderMaterial(glsl: GraphGlsl, opts: GraphShaderOptions = {}): THREE.ShaderMaterial {
  const shaders = graphShaders(glsl, opts), ir = glsl.ir, effect = ir.effectState, outline = opts.outline === true;
  const m = new THREE.ShaderMaterial({ vertexShader: shaders.vertexShader, fragmentShader: shaders.fragmentShader, uniforms: shaders.uniforms, lights: shaders.lights, fog: shaders.fog });
  m.name = outline ? 'graph:outline' : `graph:${ir.kind}`;
  m.defaultAttributeValues = { ...m.defaultAttributeValues, ...Object.fromEntries(glsl.attributes.flatMap(a => (a.default === null ? [] : [[a.name, [...a.default]]]))) };
  if (ir.kind === 'post') { m.depthTest = false; m.depthWrite = false; return m; }
  if (outline) { m.side = THREE.BackSide; return m; }
  m.side = ir.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide;
  // three reads FLAT_SHADED from the material's own flag, which ShaderMaterial does not declare: the define carries it
  if (ir.model !== 'unlit' && (ir.flatShading ?? ir.model === 'toon')) m.defines = { ...m.defines, FLAT_SHADED: '' };
  if (ir.stages.surface?.alpha !== undefined) m.transparent = ir.stages.surface.alphaCutoff === undefined;
  if (effect?.blend !== undefined) {
    m.transparent = true;
    m.blending = effect.blend === 'additive' ? THREE.AdditiveBlending : effect.blend === 'premultiplied' ? THREE.CustomBlending : THREE.NormalBlending;
    if (effect.blend === 'premultiplied') { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
  }
  if (effect?.depthWrite !== undefined) m.depthWrite = effect.depthWrite;
  if (effect?.singlePass === true || (m.transparent && m.side === THREE.DoubleSide && m.blending === THREE.AdditiveBlending && !m.depthWrite)) m.forceSinglePass = true;
  if (effect?.depthBias !== undefined) { m.polygonOffset = true; m.polygonOffsetFactor = effect.depthBias.factor; m.polygonOffsetUnits = effect.depthBias.units; }
  if (ir.stages.lighting?.grade !== undefined || (ir.model === 'unlit' && effect?.output !== 'colour')) m.toneMapped = false;
  return m;
}
