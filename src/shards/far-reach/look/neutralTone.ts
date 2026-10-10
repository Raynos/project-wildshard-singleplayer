// Sky Reach's NEUTRAL tone curve as its grid-cell display (op-frame22, SF63 / G158; behind the grid's default-off Debug
// row). The page shell's colour pass already holds a ToneMappingEffect; a second one includes three's tone-mapping chunk
// twice ('toneMappingExposure' redefinition), so the merged colour pass never compiled and the frame froze on its last
// good image (op-frame21's "Loading Sky Reach" B shot). This is the same Khronos PBR Neutral curve three ships
// (`NeutralToneMapping`, exposure 1: the game never sets the renderer's exposure), under its own name and no chunk.
import { BlendFunction, Effect } from 'postprocessing';

const FRAGMENT = `
vec3 skyNeutralCurve(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(skyNeutralCurve(inputColor.rgb), inputColor.a);
}
`;

/** The NEUTRAL tone curve over scene-linear colour, as an effect that can share a colour pass with a ToneMappingEffect. */
export class SkyNeutralToneEffect extends Effect {
  constructor() { super('SkyNeutralToneEffect', FRAGMENT, { blendFunction: BlendFunction.NORMAL }); }
}
