/**
 * The forest floor's painted textures as canvas rows (@wildshard/sdk/looks/canvasAtlas, SHARD-PLATFORM M3): the steps the
 * old painters in world/undergrowth.ts made, call for call and draw for draw from the level's seed (`SEED`). Each kind's
 * canvas goes to the SDK ground cover (./undergrowthLook.ts) as its texture.
 */
import type { CanvasAtlasRow, CanvasStep } from '@wildshard/sdk/looks/canvasAtlas';

/** One fern pinna from (bx, by) at angle `ang` (already times its side): a lobed blade filled with a tinted gradient,
 *  outline up its left edge and back down its right, then its midrib. */
const PINNA: readonly CanvasStep[] = [
  { op: 'let', vars: [['dx', 'side * cos(ang)'], ['dy', '-sin(ang) * 0.9']] },
  { op: 'let', vars: [['nx', '-dy'], ['ny', 'dx'], ['steps', 26]] },
  { op: 'fn', name: 'w', params: ['s'], body: 'wid * sin(min(1, s * 1.1) * PI) ** 0.55 * (1 - s * 0.15)' },
  { op: 'fn', name: 'serr', params: ['i'], body: 'i % 2 ? 0.7 : 1.0' },
  { op: 'let', vars: [['hue', 'range(-1, 1)']] },
  { op: 'gradient', kind: 'linear', args: ['bx', 'by', 'bx + dx * len', 'by + dy * len'], stops: [[0, 'rgb({52 + hue * 6},{82 + hue * 8},34)'], [1, 'rgb({78 + hue * 10 + t * 26},{116 + hue * 10 + t * 18},{46 + hue * 6})']] },
  { op: 'call', fn: 'beginPath' },
  { op: 'for', v: 'i', from: 0, while: 'i <= steps', next: 'i + 1', body: [
    { op: 'let', vars: [['s', 'i / steps']] },
    { op: 'let', vars: [['x', 'bx + dx * len * s + nx * w(s) * serr(i)'], ['y', 'by + dy * len * s + ny * w(s) * serr(i)']] },
    { op: 'if', cond: 'i === 0', yes: [{ op: 'call', fn: 'moveTo', args: ['x', 'y'] }], no: [{ op: 'call', fn: 'lineTo', args: ['x', 'y'] }] },
  ] },
  { op: 'for', v: 'i', from: 'steps', while: 'i >= 0', next: 'i - 1', body: [
    { op: 'let', vars: [['s', 'i / steps']] },
    { op: 'call', fn: 'lineTo', args: ['bx + dx * len * s - nx * w(s) * serr(i)', 'by + dy * len * s - ny * w(s) * serr(i)'] },
  ] },
  { op: 'call', fn: 'closePath' }, { op: 'call', fn: 'fill' },
  { op: 'set', stroke: 'rgba(150,170,80,0.55)', width: 1.1 },
  { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['bx', 'by'] },
  { op: 'call', fn: 'lineTo', args: ['bx + dx * len * 0.95', 'by + dy * len * 0.95'] }, { op: 'call', fn: 'stroke' },
];

/** A pinnate fern frond, 512 × 1024 drawn at 2×: 19 pinna pairs along a gently waved stem, longest a third of the way up. */
export const FERN_PAINT: CanvasAtlasRow = {
  w: 512, h: 1024,
  steps: [
    { op: 'scale', x: 2, y: 2 },
    { op: 'rng', seed: 'SEED + 701' },
    { op: 'fn', name: 'stemX', params: ['t'], body: '128 + sin(t * 2.2) * 6' },
    { op: 'fn', name: 'stemY', params: ['t'], body: '512 - 6 - t * (512 - 18)' },
    { op: 'let', vars: [['pairs', 19]] },
    { op: 'loop', v: 'i', n: 'pairs', body: [
      { op: 'let', vars: [['t', '(i + 0.5) / pairs']] },
      { op: 'let', vars: [['lenF', 'sin(min(1, t * 1.15) * PI) ** 0.6 * (1 - t * 0.35)']] },
      { op: 'let', vars: [['len', '12 + lenF * 100'], ['wid', '5 + lenF * 8']] },
      { op: 'each', v: 'side', of: [-1, 1], body: [
        { op: 'let', vars: [['bx', 'stemX(t)'], ['by', 'stemY(t) + side * 3']] },
        { op: 'let', vars: [['ang', '(side * (0.62 - t * 0.25) + range(-0.08, 0.08)) * side']] },
        ...PINNA,
      ] },
    ] },
    { op: 'set', stroke: 'rgb(88,96,42)', width: 3.2, cap: 'round' },
    { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['stemX(0)', 'stemY(0)'] },
    { op: 'loop', v: 'k', n: 20, body: [{ op: 'let', vars: [['t', '(k + 1) / 20']] }, { op: 'call', fn: 'lineTo', args: ['stemX(t)', 'stemY(t)'] }] },
    { op: 'call', fn: 'stroke' },
  ],
};

/** A round-leaf shrub, 512²: five six-segment twigs from the bottom, then ~80 tinted elliptic leaves with midribs. */
export const SHRUB_PAINT: CanvasAtlasRow = {
  w: 512, h: 512,
  steps: [
    { op: 'rng', seed: 'SEED + 702' },
    { op: 'let', vars: [['W', 512], ['H', 512], ['twigs', 5], ['segs', 6]] },
    { op: 'list', name: 'leafSpots' },
    { op: 'loop', v: 't', n: 'twigs', body: [
      { op: 'let', vars: [['ang', '-PI / 2 + (t - (twigs - 1) / 2) * 0.42 + range(-0.1, 0.1)']] },
      { op: 'let', vars: [['x', 'W / 2 + range(-20, 20)'], ['y', 'H - 10']] },
      { op: 'set', stroke: 'rgb(78,62,40)', width: 3.5, cap: 'round' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['x', 'y'] },
      { op: 'loop', v: 's', n: 'segs', body: [
        { op: 'let', vars: [['a', 'ang + range(-0.25, 0.25) + (s / segs) * (t - 2) * 0.2']] },
        { op: 'assign', vars: [['x', 'x + cos(a) * 60'], ['y', 'y + sin(a) * 60']] },
        { op: 'call', fn: 'lineTo', args: ['x', 'y'] },
        { op: 'if', cond: 's > 0', yes: [{ op: 'loop', v: 'l', n: 4, body: [{ op: 'push', list: 'leafSpots', vals: ['x + range(-34, 34)', 'y + range(-28, 28)', 'range(12, 22)'] }] }] },
      ] },
      { op: 'call', fn: 'stroke' },
    ] },
    { op: 'each', v: ['x', 'y', 'r'], of: 'leafSpots', body: [
      { op: 'let', vars: [['hue', 'range(-1, 1)'], ['light', 'range(0, 1)']] },
      { op: 'set', fill: 'rgb({70 + hue * 10 + light * 40},{104 + hue * 8 + light * 44},{38 + hue * 6 + light * 10})' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'ellipse', args: ['x', 'y', 'r', 'r * range(0.75, 1)', 'range(0, PI)', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
      { op: 'set', stroke: 'rgba(170,190,90,0.4)', width: 1 },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['x', 'y + r * 0.8'] }, { op: 'call', fn: 'lineTo', args: ['x', 'y - r * 0.8'] }, { op: 'call', fn: 'stroke' },
    ] },
  ],
};

/** Dark pebbles, 256²: 26 shaded grey ellipses, each lit by an off-centre radial gradient. */
export const STONE_PAINT: CanvasAtlasRow = {
  w: 256, h: 256,
  steps: [
    { op: 'rng', seed: 'SEED + 704' },
    { op: 'loop', v: 'i', n: 26, body: [
      { op: 'let', vars: [['x', 'range(24, 256 - 24)'], ['y', 'range(24, 256 - 24)'], ['rx', 'range(7, 16)']] },
      { op: 'let', vars: [['ry', 'rx * range(0.6, 0.9)'], ['a', 'range(0, PI)'], ['v', 'range(0, 1)']] },
      { op: 'gradient', kind: 'radial', args: ['x - rx * 0.3', 'y - ry * 0.4', 1, 'x', 'y', 'rx'], stops: [[0, 'rgb({96 + v * 40},{94 + v * 38},{90 + v * 34})'], [1, 'rgb({34 + v * 14},{33 + v * 12},{32 + v * 10})']] },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'ellipse', args: ['x', 'y', 'rx', 'ry', 'a', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
    ] },
  ],
};

/** Moss, 256²: a cushion of 40 dark discs, then 3,200 tufts dense in the middle and thinning outwards, 18 % bright. */
export const MOSS_PAINT: CanvasAtlasRow = {
  w: 256, h: 256,
  steps: [
    { op: 'rng', seed: 'SEED + 705' },
    { op: 'let', vars: [['S', 256]] },
    { op: 'loop', v: 'i', n: 40, body: [
      { op: 'let', vars: [['ang', 'range(0, PI * 2)'], ['rad', 'next() ** 0.8 * S * 0.28']] },
      { op: 'let', vars: [['x', 'S / 2 + cos(ang) * rad'], ['y', 'S / 2 + sin(ang) * rad * 0.85'], ['r', 'range(10, 26)'], ['v', 'range(0, 1)']] },
      { op: 'set', fill: 'rgb({30 + v * 16},{52 + v * 22},{18 + v * 8})' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'arc', args: ['x', 'y', 'r', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
    ] },
    { op: 'loop', v: 'i', n: 3200, body: [
      { op: 'let', vars: [['ang', 'range(0, PI * 2)'], ['rad', 'next() ** 0.55 * S * 0.47']] },
      { op: 'let', vars: [['x', 'S / 2 + cos(ang) * rad'], ['y', 'S / 2 + sin(ang) * rad * 0.85'], ['r', 'range(1.2, 3.6)'], ['v', 'range(0, 1)'], ['bright', 'next() < 0.18']] },
      { op: 'set', fill: 'rgb({bright ? 92 + v * 30 : 34 + v * 26},{bright ? 122 + v * 30 : 58 + v * 34},{bright ? 44 + v * 10 : 20 + v * 10})' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'arc', args: ['x', 'y', 'r', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
    ] },
  ],
};

/** Reed blades, 128 × 512: seven tall thin bent blades, every third with a brown seed head. */
export const REED_PAINT: CanvasAtlasRow = {
  w: 128, h: 512,
  steps: [
    { op: 'rng', seed: 'SEED + 706' },
    { op: 'let', vars: [['H', 512]] },
    { op: 'set', cap: 'round' },
    { op: 'loop', v: 'b', n: 7, body: [
      { op: 'let', vars: [['x0', '14 + (b / 6) * 100 + range(-6, 6)'], ['top', 'range(20, 110)'], ['bendX', 'range(-22, 22)'], ['v', 'range(0, 1)']] },
      { op: 'set', stroke: 'rgb({96 + v * 40},{120 + v * 30},{40 + v * 16})', width: 'range(3.5, 5.5)' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['x0', 'H'] },
      { op: 'call', fn: 'quadraticCurveTo', args: ['x0 + bendX * 0.4', '(H + top) / 2', 'x0 + bendX', 'top'] }, { op: 'call', fn: 'stroke' },
      { op: 'if', cond: 'b % 3 === 0', yes: [
        { op: 'set', fill: 'rgb({110 + v * 30},{70 + v * 20},36)' },
        { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'ellipse', args: ['x0 + bendX', 'top + 6', 4.5, 16, 'bendX * 0.01', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
      ] },
    ] },
  ],
};

/** Forest litter, 512²: 220 fallen needles, 14 kinked twigs and 14 dry leaves on a transparent ground. */
export const LITTER_PAINT: CanvasAtlasRow = {
  w: 512, h: 512,
  steps: [
    { op: 'rng', seed: 'SEED + 703' },
    { op: 'let', vars: [['W', 512], ['H', 512]] },
    { op: 'set', cap: 'round' },
    { op: 'loop', v: 'i', n: 220, body: [
      { op: 'let', vars: [['x', 'range(30, W - 30)'], ['y', 'range(30, H - 30)'], ['a', 'range(0, PI)'], ['l', 'range(30, 70)'], ['hue', 'range(0, 1)']] },
      { op: 'set', stroke: 'rgba({74 + hue * 42},{50 + hue * 24},{26 + hue * 10},1.0)', width: 'range(2.5, 4.2)' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['x - cos(a) * l / 2', 'y - sin(a) * l / 2'] },
      { op: 'call', fn: 'lineTo', args: ['x + cos(a) * l / 2', 'y + sin(a) * l / 2'] }, { op: 'call', fn: 'stroke' },
    ] },
    { op: 'loop', v: 'i', n: 14, body: [
      { op: 'let', vars: [['x', 'range(40, W - 40)'], ['y', 'range(40, H - 40)'], ['a', 'range(0, PI)'], ['l', 'range(60, 170)']] },
      { op: 'set', stroke: 'rgb({62 + range(0, 30)},{46 + range(0, 20)},28)', width: 'range(5, 9)' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'moveTo', args: ['x - cos(a) * l / 2', 'y - sin(a) * l / 2'] },
      { op: 'call', fn: 'lineTo', args: ['x + range(-10, 10)', 'y + range(-10, 10)'] }, { op: 'call', fn: 'lineTo', args: ['x + cos(a) * l / 2', 'y + sin(a) * l / 2'] }, { op: 'call', fn: 'stroke' },
    ] },
    { op: 'loop', v: 'i', n: 14, body: [
      { op: 'let', vars: [['x', 'range(30, W - 30)'], ['y', 'range(30, H - 30)']] },
      { op: 'set', fill: 'rgb({100 + range(0, 40)},{68 + range(0, 24)},36)' },
      { op: 'call', fn: 'beginPath' }, { op: 'call', fn: 'ellipse', args: ['x', 'y', 'range(9, 15)', 'range(5, 8)', 'range(0, PI)', 0, 'PI * 2'] }, { op: 'call', fn: 'fill' },
    ] },
  ],
};
