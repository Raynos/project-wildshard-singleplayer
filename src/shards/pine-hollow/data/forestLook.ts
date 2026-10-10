// Pine Hollow's forest looks as data (SHARD-PLATFORM M3, look-family rows): the trees' and the undergrowth's edits of the
// standard material (world/treeFactory.ts and world/undergrowth.ts apply them through @wildshard/sdk/looks/shaderEdits
// inside their patches, after the engine's wind / fade patches).
import type { ShaderEditRow } from '@wildshard/sdk/looks/shaderEdits';

/** the impostor crosses: alpha sharpened by its own derivative, both faces lit by the vertex normal, a little fill */
export const TREE_FAR_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <alphatest_fragment>', put: `
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;` },
  { stage: 'fragment', find: '#include <normal_fragment_begin>', put: { chunk: 'normal_fragment_begin', edits: [{ find: 'normal *= faceDirection;', put: '' }] } },
  { stage: 'fragment', find: '#include <lights_fragment_begin>', put: `#include <lights_fragment_begin>
          reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06;` },
];

/** the needle / twig cards: crown occlusion from the unperturbed normal, the normal bent up, the sun through the crown */
export const TREE_CROWN_EDITS: readonly ShaderEditRow[] = [
  // both faces of a card take the crown-bent vertex normal: a crown lights as a volume from any side
  { stage: 'fragment', find: '#include <normal_fragment_begin>', put: { chunk: 'normal_fragment_begin', edits: [{ find: 'normal *= faceDirection;', put: '' }] } },
  { stage: 'fragment', find: '#include <normal_fragment_maps>', put: `
            {
              vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
              diffuseColor.rgb *= mix( 1.0, 0.6, smoothstep( 0.2, -0.7, dot( nonPerturbedNormal, upV ) ) );
            }
            #include <normal_fragment_maps>
            {
              vec3 upV = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
              normal = normalize( mix( normal, upV, 0.25 ) );
            }` },
  { stage: 'fragment', find: '#include <lights_fragment_begin>', put: `#include <lights_fragment_begin>
            {
              // needle / leaf translucency: the sun through the crown toward the viewer glows
              #if NUM_DIR_LIGHTS > 0
                vec3 Lv = directionalLights[0].direction;
                vec3 Vv = normalize( vViewPosition );
                float vdotl = saturate( dot( -Vv, Lv ) );
                float trans = pow( vdotl, 5.0 ) * 0.55 + 0.08;
                reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * trans * 0.35;
              #endif
              reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.04;
            }` },
];

/** the undergrowth: darker at the root (`vH` the card's height), a crisp alpha edge, both faces alike, a back-light from the sun */
export const UNDER_EDITS: readonly ShaderEditRow[] = [
  { stage: 'fragment', find: '#include <common>', put: `#include <common>
          varying float vH;
          uniform vec3 uSunDir; uniform vec3 uSunColor;` },
  { stage: 'fragment', find: '#include <map_fragment>', put: `#include <map_fragment>
          diffuseColor.rgb *= mix( 0.55, 1.0, smoothstep( 0.0, 0.5, vH ) );` },
  { stage: 'fragment', find: '#include <alphatest_fragment>', put: `
          diffuseColor.a = clamp( ( diffuseColor.a - alphaTest ) / max( fwidth( diffuseColor.a ), 1e-4 ) + 0.5, 0.0, 1.0 );
          if ( diffuseColor.a < 0.5 ) discard;` },
  { stage: 'fragment', find: '#include <normal_fragment_begin>', put: { chunk: 'normal_fragment_begin', edits: [{ find: 'normal *= faceDirection;', put: '' }] } },
  { stage: 'fragment', find: '#include <lights_fragment_begin>', put: `#include <lights_fragment_begin>
          {
            vec3 sunV = normalize( ( viewMatrix * vec4( uSunDir, 0.0 ) ).xyz );
            float bl = pow( max( dot( normalize( - vViewPosition ), sunV ), 0.0 ), 5.0 );
            reflectedLight.indirectDiffuse += diffuseColor.rgb * ( 0.05 + bl * 0.35 ) * uSunColor;
          }` },
];

/** the undergrowth's vertex stage (lit and shadow-depth): the distance fade (scale to 0) and the gentle wind */
export const UNDER_VERTEX_EDITS: readonly ShaderEditRow[] = [
  { stage: 'vertex', find: '#include <common>', put: `#include <common>
      uniform float uWindStrength; uniform float uWindScale; uniform float uFadeFar; uniform float uFadeBand; uniform vec3 uViewerPos;
      varying float vH;` },
  { stage: 'vertex', find: '#include <begin_vertex>', put: `#include <begin_vertex>
      {
        mat3 im = mat3( instanceMatrix );
        vec3 ipos = ( modelMatrix * vec4( instanceMatrix[3].xyz, 1.0 ) ).xyz;
        float dist = distance( ipos, uViewerPos );
        float fade = 1.0 - smoothstep( uFadeFar - uFadeBand, uFadeFar, dist );
        transformed *= fade;
        float h = uv.y;
        vH = h;
        float s2 = dot( im[0], im[0] );
        vec3 wpos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
        vec2 dir = windDirXZ();
        float phase = dot( wpos.xz, dir ) * 0.32;
        float swell = sin( uWindTime * 1.25 - phase ) * 0.5 + 0.5;
        float gust = min( windGustAt( wpos.xz ), 1.3 ) * ( 0.35 + 0.65 * swell * swell ) * 1.25;
        float flutter = sin( uWindTime * 5.0 + wpos.x * 3.0 + wpos.z * 2.0 );
        float amp = ( 0.01 + gust * 0.05 ) * uWindStrength * uWindScale * 4.0;
        float w = h * h;
        vec3 off = vec3( dir.x * amp + flutter * 0.006, 0.0, dir.y * amp + flutter * 0.004 ) * w;
        off.y = - length( off.xz ) * 0.3;
        transformed += ( off * im ) / max( s2, 1e-6 ) * fade;
      }` },
];
