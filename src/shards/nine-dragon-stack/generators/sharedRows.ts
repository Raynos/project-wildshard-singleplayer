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
export const NINE_SHARED: { id: string; rows: { bandDepth: number; uHalo: { v4: number[]; }; uHaloKind: { v4: number[]; }; uHaloFar: { v4: number[]; }; uHaloProjection: number; uLpGain: { v4: number[]; }; uLpSky: number; uLpAmb: number; uLpSpec: { v4: number[]; }; uLpRim: { v4: number[]; }; uLpCut: { v4: number[]; }; uLpAmber: { v4: number[]; }; uPaintK: { v4: number[]; }; uPaintK2: { v4: number[]; }; uPaintInk: { rgb: number; }; uGroundY: number; uShaft: { v4: number[]; }; uShaftK: { v4: number[]; }; uTime: number; uCam: { v3: number[]; }; uRootAt: { v3: number[]; }; uRes: { v2: number[]; }; uDpr: number; uNear: number; uLinePx: number; uGroundPx: number; uLineFade: { v2: number[]; }; uInkMid: number; uInk0: { rgb: number; }; uInk1: { rgb: number; }; uLineFog: number; uGoldDim: { rgb: number; }; uLightDir: { v3: number[]; normalize: boolean; }; uShade: { rgb: number; }; uPool: number; uStain: number; uMottle: number; uWeave: number; uSilkPaper: number; uWashTint: { v3: number[]; }; uWinWarm: { rgb: number; }; uWinCool: { rgb: number; }; uWinDark: { rgb: number; }; uSutraWin: { rgb: number; }; uFogBase: number; uFogStart: number; uFogBaseCol: { rgb: number; }; uBands: { v4s: number[][]; }; uBandCols: { rgbs: number[]; }; uBandWin: { v3: number[]; }; uGlint: { v4: number[]; }; uAccentFog: number; uFlag: { v4: number[]; }; uFlagJoint: number; uTilePitch: { v2: number[]; }; uPaintFlag: number; uPaintStone: { v3: number[]; }; uShaftLit: number; uFogDeep: { v4: number[]; }; uDeepAir: { v4: number[]; }; uDeepAir2: { v4: number[]; }; uPuff: { v2: number[]; }; uDeepAmb: { v4: number[]; }; uWetSky: { v2: number[]; }; uDry: number; uSilver: { rgb: number; }; uGold: { rgb: number; }; uPaper: { rgb: number; }; uPaperDeep: { rgb: number; }; }; textures: { uSilk: string; uLpVolA: string; uLpVolB: string; }; vectors: { uLpMinA: string; uLpInvA: string; uLpMinB: string; uLpInvB: string; }; numbers: { uLpMax: string; }; } = {
  id: 'nine-shared',
  rows: { ...sharedUniforms, uGroundY: layoutPlan.Y0, uShaft: { v4: [SHAFT.x0, SHAFT.z0, SHAFT.x1, SHAFT.z1] }, uShaftK: { v4: [shaftK0, layoutPlan.Y0, shaftK2, shaftK3] },
    ...paint.uniforms, ...poolRows, ...light.haloUniforms, bandDepth: 1 },
  textures: { uSilk: 'nine.silk', uLpVolA: 'light.A', uLpVolB: 'light.B' },
  vectors: { uLpMinA: 'light.A.min', uLpInvA: 'light.A.inv', uLpMinB: 'light.B.min', uLpInvB: 'light.B.inv' },
  numbers: { uLpMax: 'light.B.maximum' },
};
