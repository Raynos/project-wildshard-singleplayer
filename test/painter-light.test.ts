import { describe, expect, it } from 'vitest';
import { painterLightGlsl } from '@wildshard/engine/render/dataLook';
import { SKY_PAINTER_LIGHT, SKY_SUN } from '../src/shards/far-reach/data/skyLook';
import { LAST_LIGHT, LAST_LIGHT_SUN } from '../src/shards/sunscar-dunes/data/lightLook';

/** the text's length and FNV-1a hash: pins a program without carrying its source */
const pin = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ (text.codePointAt(i) ?? 0), 0x01000193) >>> 0;
  return `${text.length}:${h.toString(16)}`;
};

// G406 (one shared painted look): Sky Reach's painter light and Signal Dunes' "Last Light" are rows of one family
describe('the shared painter light', () => {
  it("keeps Sky Reach's program byte for byte", () => {
    const glsl = painterLightGlsl(SKY_PAINTER_LIGHT, { x: SKY_SUN[0], y: SKY_SUN[1], z: SKY_SUN[2] });
    expect(pin(glsl)).toBe('1001:15f6c6b2');
  });

  it("draws Signal's afterglow edge: an unshaped rim and the cool lift on the base colour, no bounce or floor", () => {
    const glsl = painterLightGlsl(LAST_LIGHT, LAST_LIGHT_SUN);
    expect(glsl).toContain('float sunscarRim = pow( 1.0 - sunscarNV, 3.0 ) * ( 1.0 + 0.0 * sunscarBack * sunscarBack ) * ( 1.0 + 0.0 * sunscarSide );');
    expect(glsl).toContain('reflectedLight.directDiffuse += diffuseColor.rgb * ( vec3(0.2400,0.2100,0.3600) + vec3(1.2000,0.6000,0.2640) * sunscarRim );');
    expect(glsl).not.toContain('indirectDiffuse');
    expect(glsl).toContain('#ifndef SUNSCAR_NO_RIM');
  });
});
