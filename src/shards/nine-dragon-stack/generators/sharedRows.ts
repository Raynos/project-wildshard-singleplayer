import sharedUniforms from '../data/sharedUniforms.json' with { type: 'json' };
import layoutPlan from '../data/layoutPlan.json' with { type: 'json' };
import paint from '../data/paint.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import { SHAFT } from './wellBounds';

// G599 N7: the world's shared uniform set ('nine-shared', the post look's live set and its 'nine.frame' channel group's
// bag) as rows of the world scenes' uniform set: the look's shared rows at the square's datum (the ground, and the Well's
// silk mist in dome C's SHAFT box, the main shaft and its run north, under the rim), the painted surfaces' strengths, the
// light pools' rows and the halos', and the silk fog's band depth (the channel group writes it each frame). The silk weave
// and the light volumes, their boxes and peak are bound from the scene handles their lent textures publish.
const [shaftK0 = 0, , shaftK2 = 0, shaftK3 = 0] = sharedUniforms.uShaftK.v4;
const { uLpMax: _max, uLpMinA: _minA, uLpInvA: _invA, uLpMinB: _minB, uLpInvB: _invB, ...poolRows } = light.volume;
export const NINE_SHARED = {
  id: 'nine-shared',
  rows: { ...sharedUniforms, uGroundY: layoutPlan.Y0, uShaft: { v4: [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1] }, uShaftK: { v4: [shaftK0, layoutPlan.Y0, shaftK2, shaftK3] },
    ...paint.uniforms, ...poolRows, ...light.haloUniforms, bandDepth: 1 },
  textures: { uSilk: 'nine.silk', uLpVolA: 'light.A', uLpVolB: 'light.B' },
  vectors: { uLpMinA: 'light.A.min', uLpInvA: 'light.A.inv', uLpMinB: 'light.B.min', uLpInvB: 'light.B.inv' },
  numbers: { uLpMax: 'light.B.maximum' },
};
