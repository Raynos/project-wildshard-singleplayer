/**
 * The homestead's painted textures as canvas rows (@wildshard/sdk/looks/canvasAtlas, SHARD-PLATFORM M3): the steps the
 * old painters in world/homestead.ts made, call for call and draw for draw from the level's seed (`SEED`). The log ends'
 * end grain (weathering speckle, sine-warped growth rings, checks and the bark rim), the lamps' soft glow, and the
 * particles' value noise (three octaves on a 128² lattice).
 */
import type { CanvasAtlasRow } from '@wildshard/sdk/looks/canvasAtlas';

/** A log end's grain, 256²: the speckle, the warped rings (each a 65-point closed path), seven checks and the rim. */
export const END_GRAIN_PAINT: CanvasAtlasRow = {
  w: 256, h: 256,
  steps: [
    { op: 'set', fill: '#9d8b6c' }, { op: 'fillRect', x: 0, y: 0, w: 256, h: 256 },
    { op: 'rng', seed: 'SEED + 31' },
    { op: 'loop', v: 'i', n: 6000, body: [
      { op: 'set', fill: "{next() < 0.5 ? 'rgba(60,45,30,0.25)' : 'rgba(200,185,160,0.2)'}" },
      { op: 'call', fn: 'fillRect', args: ['range(0, 256)', 'range(0, 256)', '1 + range(0, 2)', '1 + range(0, 2)'] },
    ] },
    { op: 'for', v: 'r', from: 4, while: 'r < 128', next: 'r + (3 + range(0, 4))', body: [
      { op: 'call', fn: 'beginPath' },
      { op: 'for', v: 'a', from: 0, while: 'a <= 64', next: 'a + 1', body: [
        { op: 'let', vars: [['th', '(a / 64) * PI * 2']] },
        { op: 'let', vars: [['rr', 'r * (1 + 0.05 * sin(th * 3 + r) + 0.03 * sin(th * 7))']] },
        { op: 'let', vars: [['x', '128 + cos(th) * rr'], ['y', '128 + sin(th) * rr']] },
        { op: 'if', cond: 'a > 0', yes: [{ op: 'call', fn: 'lineTo', args: ['x', 'y'] }], no: [{ op: 'call', fn: 'moveTo', args: ['x', 'y'] }] },
      ] },
      { op: 'call', fn: 'closePath' },
      { op: 'set', stroke: "{next() < 0.5 ? 'rgba(70,50,30,0.5)' : 'rgba(110,85,55,0.35)'}", width: '0.8 + range(0, 1.4)' },
      { op: 'call', fn: 'stroke' },
    ] },
    { op: 'set', stroke: 'rgba(40,28,15,0.8)' },
    { op: 'loop', v: 'i', n: 7, body: [
      { op: 'let', vars: [['th', 'range(0, PI * 2)'], ['l', 'range(50, 122)']] },
      { op: 'set', width: '1 + range(0, 2)' },
      { op: 'call', fn: 'beginPath' },
      { op: 'call', fn: 'moveTo', args: ['128 + cos(th) * 8', '128 + sin(th) * 8'] },
      { op: 'call', fn: 'lineTo', args: ['128 + cos(th + 0.05) * l', '128 + sin(th + 0.05) * l'] },
      { op: 'call', fn: 'stroke' },
    ] },
    { op: 'set', stroke: '#3d2c1c', width: 9 },
    { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'arc', args: [128, 128, 124, 0, 'PI * 2'] }, { op: 'call', fn: 'stroke' },
  ],
};

/** A lamp's glow, 128²: a white radial falloff (the lamp's colour is its material's). */
export const GLOW_PAINT: CanvasAtlasRow = {
  w: 128, h: 128,
  steps: [{ op: 'radial', from: [64, 64, 0], to: [64, 64, 64], stops: [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']], x: 0, y: 0, w: 128, h: 128 }],
};

/** The smoke / flame / ember particles' noise, 128²: value noise of 8², 16² and 32² lattices, amplitudes 0.55 halving. */
export const NOISE_PAINT: CanvasAtlasRow = {
  w: 128, h: 128,
  steps: [{ op: 'rng', seed: 'SEED + 77' }, { op: 'valueNoise', size: 128, octaves: [8, 16, 32], amp: 0.55, gain: 0.5 }],
};
