import type { GraphIr, GraphNode, GraphParam, GraphRef } from '@wildshard/format/materialGraph';

/**
 * Pine Hollow's keyed sky as SF59 material graphs (SHARD-PLATFORM W2 C2; it was the keyed sky's GLSL program): the dome
 * the camera sits in and the same sky drawn into the environment equirect (runtime/looks/keyedSky). Both read two baked
 * equirect keys at a time, lent by the runtime as they decode (`keyA`, `keyB`: `role: 'lent'`), blended by `mix`, each
 * turned about the vertical (`rotA`, `rotB`: cos, sin) so its sun glow sits on the clock's sun or moon and scaled by its
 * gain; then the analytic aureole round `lightDir` (`glow`, above the haze line) and the weather's cloud deck (`grey`:
 * the photo's blue and clouds go to a flat cool grey near `flat`). The runtime sets every param each frame.
 *
 *   dome: a back-faced sphere, the direction its own vertex position
 *   env:  one clip-space triangle over the equirect target, the direction from the target's uv (u round, v up)
 */

/** the look.materials ids the sky's graphs are worn under */
export const SKY_LOOKS = { dome: 'pine-sky-dome', env: 'pine-sky-env' } as const;

const TAU = 2 * Math.PI;

function skyGraph(env: boolean): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `s${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const param = (name: string): string => op('param', undefined, { param: name });
  let dir: string, clip: string | null = null;
  if (env) {
    const corner = swz(op('positionGeometry'), 'xy');
    clip = op('combine', [corner, 0, 1]);
    const uv = op('varying', [add(mul(corner, 0.5), 0.5)]);
    const th = mul(sub(swz(uv, 'x'), 0.5), TAU), ph = mul(sub(swz(uv, 'y'), 0.5), Math.PI), cosPh = op('cos', [ph]);
    dir = op('combine', [mul(op('cos', [th]), cosPh), op('sin', [ph]), mul(op('sin', [th]), cosPh)]);
  } else dir = op('normalize', [op('varying', [op('positionGeometry')])]);
  const dx = swz(dir, 'x'), dy = swz(dir, 'y'), dz = swz(dir, 'z');
  // three's equirectUv of the turned direction; its v is asin(y) = atan(y, |xz|), and the turn keeps |xz|
  const v = add(mul(op('atan', [dy, op('length', [swz(dir, 'xz')])]), 1 / Math.PI), 0.5);
  const key = (tex: string, rot: string): string => {
    const c = swz(param(rot), 'x'), s = swz(param(rot), 'y');
    const u = add(mul(op('atan', [add(mul(s, dx), mul(c, dz)), sub(mul(c, dx), mul(s, dz))]), 1 / TAU), 0.5);
    return swz(op('texture', [op('combine', [u, v])], { param: tex }), 'xyz');
  };
  const blend = param('mix');
  let col = add(mul(key('keyA', 'rotA'), mul(param('gainA'), op('oneMinus', [blend]))), mul(key('keyB', 'rotB'), mul(param('gainB'), blend)));
  const mu = op('clamp', [op('dot', [dir, param('lightDir')]), 0, 1]);
  const up = op('smoothstep', [-0.12, 0.02, dy]); // the aureole stays above the haze line
  const aureole = add(add(mul(op('pow', [mu, 900]), 0.55), mul(op('pow', [mu, 60]), 0.3)), mul(op('pow', [mu, 8]), 0.12));
  col = add(col, mul(param('glow'), mul(aureole, up)));
  // the weather's cloud deck: the photo's own clouds soften into it (mostly the flat deck, a little of their shading left)
  const lum = op('dot', [col, [0.2126, 0.7152, 0.0722]]);
  const deck = mul(op('mix', [op('combine', [lum, lum, lum]), param('flat'), 0.7]), [0.94, 0.97, 1]);
  col = op('mix', [col, deck, param('grey')]);
  const lent = (slot: string): GraphParam => ({ type: 'texture', value: slot, role: 'lent' });
  return {
    version: 1, kind: 'material', model: 'unlit', budget: { nodes: 160, samplers: 2, instructions: 480 }, effectState: { depthWrite: false, fog: false },
    params: {
      keyA: lent('sky-key-a'), keyB: lent('sky-key-b'),
      mix: { type: 'float', value: 0, min: 0, max: 1 },
      rotA: { type: 'vec2', value: [1, 0], min: -1, max: 1 }, rotB: { type: 'vec2', value: [1, 0], min: -1, max: 1 },
      gainA: { type: 'float', value: 1, min: 0, max: 64 }, gainB: { type: 'float', value: 1, min: 0, max: 64 },
      lightDir: { type: 'vec3', value: [0, 1, 0], min: -1.001, max: 1.001 },
      glow: { type: 'vec3', value: [0, 0, 0], min: 0, max: 64 },
      grey: { type: 'float', value: 0, min: 0, max: 1 },
      flat: { type: 'vec3', value: [0, 0, 0], min: 0, max: 64 },
    },
    nodes, stages: { ...(clip === null ? {} : { 'vertex.clip': { position: clip } }), surface: { colour: col } },
  };
}

/** The sky's graphs by look.materials id. */
export const SKY_GRAPHS: Readonly<Record<string, GraphIr>> = { [SKY_LOOKS.dome]: skyGraph(false), [SKY_LOOKS.env]: skyGraph(true) };
