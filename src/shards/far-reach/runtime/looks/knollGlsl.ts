import { KNOLLS, type Knoll } from '../../data/layout';

const knollR = (k: Knoll): number => (k.base * k.base + k.h * k.h) / (2 * k.h);
/** The rises as GLSL: `farKnoll(p)` is their height at a world xz. */
export const KNOLL_GLSL = `float farKnoll(vec2 p){ float y = 0.0; float d;
${KNOLLS.map((k) => { const R = knollR(k); return ` d = distance(p, vec2(${k.x.toFixed(2)}, ${k.z.toFixed(2)})); if (d < ${k.base.toFixed(2)}) y += sqrt(${(R * R).toFixed(4)} - d * d) - ${(R - k.h).toFixed(4)};`; }).join('\n')}
 return y; }`;
