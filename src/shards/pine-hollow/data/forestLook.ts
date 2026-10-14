// Pine Hollow's forest looks as data (SHARD-PLATFORM M3, look-family rows): the trees' edits of the standard material
// (world/treeFactory.ts applies them through @wildshard/game/systems/looks/shaderEdits
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
