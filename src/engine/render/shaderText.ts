/**
 * Shader text before three builds a program (js-heap H10). three's WebGLProgram rewrites a classic material's source with
 * one regex replace per light and clipping count (13 + 2) after resolving its `#include`s afresh, and each replace that
 * finds its token copies the whole shader: the Template's boot made ~25 MiB of short-lived shader strings that way.
 *
 *   finishShaderText(shader)   resolve its includes (each chunk's resolution cached) and fill every count in one pass
 *
 * The result is exactly what three's own passes make, so its passes then find nothing to replace and copy nothing; its
 * loop unrolling still runs after, as before. It runs last in a material's `onBeforeCompile` (shaderPatches' runner,
 * after every patch, since the patches find their place by the unresolved `#include` lines). A chunk three does not
 * know (a deprecated name) stays an include line for three to resolve or refuse.
 */
import * as THREE from 'three';

type ShaderText = Pick<THREE.WebGLProgramParametersWithUniforms, 'vertexShader' | 'fragmentShader' | 'numSunLights' | 'numDirLights'
  | 'numSpotLights' | 'numSpotLightMaps' | 'numRectAreaLights' | 'numPointLights' | 'numHemiLights' | 'numSunLightShadows'
  | 'numDirLightShadows' | 'numSpotLightShadowsWithMaps' | 'numSpotLightShadows' | 'numPointLightShadows' | 'numClippingPlanes'
  | 'numClipIntersection'>;

/** three's include line (WebGLProgram's `includePattern`) */
const INCLUDE = /^[ \t]*#include +<([\w\d./]+)>/gm;
/** every count three fills, longest first where one name starts another (its sequential order gives the same text) */
const COUNT = /NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS|NUM_SPOT_LIGHT_SHADOWS|NUM_SPOT_LIGHT_MAPS|NUM_SPOT_LIGHT_COORDS|NUM_SPOT_LIGHTS|NUM_SUN_LIGHT_SHADOWS|NUM_SUN_LIGHTS|NUM_DIR_LIGHT_SHADOWS|NUM_DIR_LIGHTS|NUM_POINT_LIGHT_SHADOWS|NUM_POINT_LIGHTS|NUM_RECT_AREA_LIGHTS|NUM_HEMI_LIGHTS|NUM_CLIPPING_PLANES|UNION_CLIPPING_PLANES/g;

/** each chunk's resolved text, kept while the chunk's own text is the same (a look may replace a chunk) */
const chunks = new Map<string, { raw: string; resolved: string }>();
const chunkText: Readonly<Record<string, string | undefined>> = THREE.ShaderChunk;

function resolved(name: string): string | undefined {
  const raw = chunkText[name];
  if (raw === undefined) return undefined;
  const known = chunks.get(name);
  if (known !== undefined && known.raw === raw) return known.resolved;
  const text = resolveIncludes(raw);
  chunks.set(name, { raw, resolved: text });
  return text;
}

/** three's resolveIncludes, each chunk resolved once */
export function resolveIncludes(source: string): string {
  return source.replaceAll(INCLUDE, (line: string, name: string) => resolved(name) ?? line);
}

/** three's replaceLightNums and replaceClippingPlaneNums in one pass */
export function fillCounts(source: string, shader: ShaderText): string {
  const values: Record<string, number> = {
    NUM_SUN_LIGHTS: shader.numSunLights, NUM_DIR_LIGHTS: shader.numDirLights, NUM_SPOT_LIGHTS: shader.numSpotLights,
    NUM_SPOT_LIGHT_MAPS: shader.numSpotLightMaps,
    NUM_SPOT_LIGHT_COORDS: shader.numSpotLightShadows + shader.numSpotLightMaps - shader.numSpotLightShadowsWithMaps,
    NUM_RECT_AREA_LIGHTS: shader.numRectAreaLights, NUM_POINT_LIGHTS: shader.numPointLights, NUM_HEMI_LIGHTS: shader.numHemiLights,
    NUM_SUN_LIGHT_SHADOWS: shader.numSunLightShadows, NUM_DIR_LIGHT_SHADOWS: shader.numDirLightShadows,
    NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS: shader.numSpotLightShadowsWithMaps, NUM_SPOT_LIGHT_SHADOWS: shader.numSpotLightShadows,
    NUM_POINT_LIGHT_SHADOWS: shader.numPointLightShadows, NUM_CLIPPING_PLANES: shader.numClippingPlanes,
    UNION_CLIPPING_PLANES: shader.numClippingPlanes - shader.numClipIntersection,
  };
  return source.replaceAll(COUNT, (name: string) => String(values[name]));
}

/** Resolve a program's includes and fill its counts, as three would, before three builds it. */
export function finishShaderText(shader: ShaderText): void {
  shader.vertexShader = fillCounts(resolveIncludes(shader.vertexShader), shader);
  shader.fragmentShader = fillCounts(resolveIncludes(shader.fragmentShader), shader);
}
