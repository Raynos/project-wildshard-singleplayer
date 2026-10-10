// SHARD-PLATFORM M3 (look-family rows): the Blender cove's look as data (world/BlenderIsland.ts builds it through
// @wildshard/sdk/looks/bakedIsland and @wildshard/sdk/looks/instancedTiles): its files, tile counts, reaches, material
// settings, the placement name patterns and the GLSL edits of its terrain, props and cover (`@{name}` splices what the
// SDK formats from the numbers here: the cover's reach to one decimal, the AO share to two, the clipped rect to three).
import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/**
 * The tiers' numbers. Tiles per side: the casters (palms, rocks, logs; near + far copies) and the ground cover.
 * `cover`: ground cover thins out plant by plant instead of its tile blinking off (E117): every plant inside `near` stands;
 * past it each plant has its own edge in [near + grow, far], takes on the ground's colour and shade over the `grow` m
 * before it and is gone past it (E156), measured from its base. `big`: E156, the bushes, flowering bushes, hibiscus and
 * ferns keep their reach far longer on the phone (Jake's video, 2026-09-25, by the pier: "they still pop in").
 * `share`: the phone builds 70 % of the small cover (the palms, rocks and logs always build; the file is a prefix).
 */
export const ISLAND_TIERS = {
  phone: { casterTiles: 6, coverTiles: 8, share: 0.7, cover: { near: 16, far: 40, grow: 6 }, big: { near: 50, far: 80, grow: 10 }, coverUrl: '/assets/models/driftwood-blender/island-cover.phone.bin' },
  desktop: { casterTiles: 3, coverTiles: 4, share: 1, cover: { near: 100, far: 148, grow: 12 }, big: { near: 100, far: 148, grow: 12 }, coverUrl: '/assets/models/driftwood-blender/island-cover.desktop.bin' },
};

/**
 * The tier-free numbers. `lod`: past this (m, camera to the tile's rect) a caster tile draws its far copy (E90: the palms
 * keep their full model to 110 m on the phone too, and every far copy casts). `far`: E117, a caster's far copy is its near
 * one simplified to `ratio` of the triangles, never past `error` of its size (~8 cm on a palm). `coverDepth`: how much of
 * the cover the splat turns into optical depth. `coverFile`: the baked splat's magic ('WSIC') and version. `names`: which
 * placements set apart (E114: the shore boulders are Boulders.ts's, the small rocks rockKit's), which kinds cast, which
 * cover is big. `protoPrefix`: the prototypes' mesh names in island.glb.
 */
export const ISLAND_LOOK = {
  lod: 110,
  far: { ratio: 0.25, error: 0.01 },
  coverDepth: 0.6,
  coverFile: { magic: 0x43495357, version: 1 },
  names: { casterKinds: ['palm', 'rock', 'prop'], skip: '^rockb?\\d+$', apart: '^smallrock\\d+$', big: '^(bush|flowerbush|hibiscus|fern)\\d+$' },
  protoPrefix: 'proto_',
  meshPrefix: 'island-',
  coverKeys: { cover: 'island-cover', big: 'island-cover-big' },
  palmCell: 8,
};

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
