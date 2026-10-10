// SHARD-PLATFORM M3 (look-family rows): world/coverTint.ts's GLSL as data for the SDK shader family (@wildshard/sdk/looks/shaderFamily).
// `@{name}` splices another fragment here.
export const COVER_GLSL = {
  coverSeen: /* glsl */`
float coverSeen( float top, float side, float facing ) {
  float f = clamp( facing, 0.03, 1.0 );
  float tau = -log( max( 1.0 - top, 1e-3 ) ) - log( max( 1.0 - side, 1e-3 ) ) * sqrt( 1.0 - f * f ) / f;
  return 1.0 - exp( -tau );
}`,
  vertexCommon: '#include <common>\nattribute vec4 aCover;\nattribute float aCoverSide;\nflat varying vec4 vCover;\nflat varying float vCoverSide;',
  vertexBegin: '#include <begin_vertex>\nvCover = aCover; vCoverSide = aCoverSide;',
  fragmentCommon: '#include <common>\nflat varying vec4 vCover;\nflat varying float vCoverSide;\n@{coverSeen}',
  fragmentNormal: /* glsl */`#include <normal_fragment_maps>
	diffuseColor.rgb = mix( diffuseColor.rgb, vCover.rgb, coverSeen( vCover.a, vCoverSide, abs( dot( normal, normalize( vViewPosition ) ) ) ) );`,
};

/** The terrain tint's patch: its id and the suffix its program key takes (world/coverTint.ts). */
export const COVER_TINT = { patchId: 'driftwood.cover-tint', keySuffix: '|cover-tint' };
