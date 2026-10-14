// SHARD-PLATFORM M3 (look-family rows): world/coverTint.ts's trusted GLSL: `coverSeen`, and the terrain tint's edits
// (`@{coverSeen}` splices it).
import type { ShaderEditRow } from '@wildshard/game/plugin/shaderFamily';

export const COVER_GLSL = {
  coverSeen: /* glsl */`
float coverSeen( float top, float side, float facing ) {
  float f = clamp( facing, 0.03, 1.0 );
  float tau = -log( max( 1.0 - top, 1e-3 ) ) - log( max( 1.0 - side, 1e-3 ) ) * sqrt( 1.0 - f * f ) / f;
  return 1.0 - exp( -tau );
}`,
  // after the normal is known (flat: from derivatives) and before the lights read diffuseColor
  edits: [
    { stage: 'vertex', find: '#include <common>', put: '#include <common>\nattribute vec4 aCover;\nattribute float aCoverSide;\nflat varying vec4 vCover;\nflat varying float vCoverSide;' },
    { stage: 'vertex', find: '#include <begin_vertex>', put: '#include <begin_vertex>\nvCover = aCover; vCoverSide = aCoverSide;' },
    { stage: 'fragment', find: '#include <common>', put: '#include <common>\nflat varying vec4 vCover;\nflat varying float vCoverSide;\n@{coverSeen}' },
    { stage: 'fragment', find: '#include <normal_fragment_maps>', put: /* glsl */`#include <normal_fragment_maps>
	diffuseColor.rgb = mix( diffuseColor.rgb, vCover.rgb, coverSeen( vCover.a, vCoverSide, abs( dot( normal, normalize( vViewPosition ) ) ) ) );` },
  ] satisfies ShaderEditRow[],
};

/** The terrain tint's patch: its id and the suffix its program key takes (world/coverTint.ts). */
export const COVER_TINT = { patchId: 'driftwood.cover-tint', keySuffix: '|cover-tint' };
