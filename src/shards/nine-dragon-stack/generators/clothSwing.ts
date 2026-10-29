import type { LookGraph } from './lookGraph';
import cloth from '../data/cloth.json' with { type: 'json' };

/**
 * NR7 view F: the held pendants were baked hanging along the level idle's down (REST_GRAVITY, in the weapon bone's frame,
 * which is their meshes' own). LEGACY simulates them live with the world's down, so when you look down the tassel streams
 * over the blade; this turns each vertex about its pivot (`aClothPivot`: the knot for the tassel's strands, the cord's end
 * for the fu, the vertex itself for the cords) from the rest down to the world's down turned into that frame, a rigid
 * turn (Rodrigues on the unnormalised axis, so no singular axis at zero turn), applied twice: the bone frame's down turns
 * ~0.65x the view's pitch under the viewmodel squeeze, LEGACY's cloth further. Not a live simulation. Returns `offset`
 * with the turn added (both local vectors).
 */
export function viewGravitySwing(g: LookGraph, offset: string): string {
  const [rx = 0, ry = -1, rz = 0] = cloth.REST_GRAVITY, rl = Math.hypot(rx, ry, rz);
  const rest = g.vec(rx / rl, ry / rl, rz / rl), live = g.op('normalize', [g.op('worldToLocal', [g.vec(0, -1, 0)])]);
  const axis = g.op('cross', [rest, live]), cos = g.op('dot', [rest, live]), arm = g.sub(g.op('positionGeometry'), g.a('aClothPivot', 'vec3'));
  const turn = (v: string): string => g.add(g.add(g.mul(v, cos), g.op('cross', [axis, v])), g.mul(axis, g.div(g.op('dot', [axis, v]), g.max(g.add(cos, 1), 0.05))));
  return g.add(offset, g.sub(turn(turn(arm)), arm));
}
