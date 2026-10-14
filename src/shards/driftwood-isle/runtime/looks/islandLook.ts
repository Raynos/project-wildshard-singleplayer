// SHARD-PLATFORM M3 (look-family rows): the Blender cove's look as trusted configuration (world/BlenderIsland.ts builds it through
// @wildshard/sdk/looks/bakedIsland and @wildshard/sdk/looks/instancedTiles): its files, tile counts, reaches, material
// settings, the placement name patterns and the GLSL edits of its terrain, props and cover (`@{name}` splices what the
// SDK formats from the numbers here: the cover's reach to one decimal, the AO share to two, the clipped rect to three).
import type { ShaderEditRow } from '@wildshard/game/plugin/shaderFamily';

/** the instanced cover GroundCover leaves inside the cove collapses at its origin (no discard, no CPU per frame) */
export const ISLAND_CLIP = {
  patch: 'driftwood.island-clip',
  key: 'island-clip',
  edits: [
    { stage: 'vertex', find: '#include <project_vertex>', put: '#include <project_vertex>\n#ifdef USE_INSTANCING\n\t{ vec4 io = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );\n\t  if ( io.x > @{x0} && io.x < @{x1} && io.z > @{z0} && io.z < @{z1} ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); }\n#endif' },
  ] satisfies ShaderEditRow[],
};

/** the cove's terrain: the baked AO also grounds the direct light a little (contact shade under the palms, the rocks, the
 *  pier): `aoDirect` of it reaches the sun (0 = physically only the fill) */
export const ISLAND_TERRAIN = {
  patch: 'driftwood.island-terrain',
  key: 'island-terrain',
  roughness: 0.92,
  aoDirect: 0.45,
  edits: [
    { stage: 'fragment', find: '#include <aomap_fragment>', put: '#include <aomap_fragment>\n\treflectedLight.directDiffuse *= mix( 1.0, ambientOcclusion, @{aoDirect} );' },
  ] satisfies ShaderEditRow[],
};

/**
 * The cove's props. `ao`: the colour's alpha is the prototype's Cycles AO: all of the fill, a little of the sun (the
 * crown's inner fronds). `tint`: G144, each placement's tint applied per vertex as the merged tiles baked it
 * (`min(255, colour × tint)` truncated to a Uint8). `fade`: E156, past its edge a plant is gone, and over the grow m
 * before it it takes on the colour and shade of the ground it stands on (the cover grid's) instead of sinking (Jake: the
 * plants "bouncing like they're being reanimated"); measured from the plant's own base, so the whole plant goes at once.
 */
export const ISLAND_PROPS = {
  patch: 'driftwood.island-props',
  key: 'island-props',
  tintKey: '|inst',
  roughness: 0.9,
  ao: [
    { stage: 'fragment', find: '#include <aomap_fragment>', put: '#include <aomap_fragment>\n\treflectedLight.indirectDiffuse *= vColor.a;\n\treflectedLight.directDiffuse *= mix( 1.0, vColor.a, 0.35 );' },
  ] satisfies ShaderEditRow[],
  tint: [
    { stage: 'vertex', find: '#include <common>', put: '#include <common>\nattribute float aTint;' },
    { stage: 'vertex', find: '#include <color_vertex>', put: '#include <color_vertex>\n#ifdef USE_INSTANCING\n\tvColor.rgb = min( floor( floor( color.rgb * 255.0 + 0.5 ) * aTint ), vec3( 255.0 ) ) / 255.0;\n#endif' },
  ] satisfies ShaderEditRow[],
  fade: [
    { stage: 'vertex', find: '#include <common>', put: '#include <common>\nattribute float aEdge;\nattribute vec3 aBase;\nattribute vec4 aGround;\nvarying vec4 vGround;\nvarying float vFar;\nvarying float vGone;' },
    { stage: 'vertex', find: '#include <begin_vertex>', put: '#include <begin_vertex>\n\t{ float edge = mix( @{edgeNear}, @{far}, aEdge ), d = distance( aBase, cameraPosition );\n\t  vFar = smoothstep( edge - @{grow}, edge, d ) * aGround.a; vGround = aGround; vGone = step( edge, d ); }' },
    { stage: 'vertex', find: '#include <project_vertex>', put: '#include <project_vertex>\n\tif ( vGone > 0.5 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );' },
    { stage: 'fragment', find: '#include <common>', put: '#include <common>\nvarying vec4 vGround;\nvarying float vFar;' },
    { stage: 'fragment', find: '#include <color_fragment>', put: '#include <color_fragment>\n\tdiffuseColor.rgb = mix( diffuseColor.rgb, vGround.rgb, vFar );' },
    { stage: 'fragment', find: '#include <normal_fragment_begin>', put: '#include <normal_fragment_begin>\n\tnormal = normalize( mix( normal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ), vFar ) );' },
  ] satisfies ShaderEditRow[],
};
