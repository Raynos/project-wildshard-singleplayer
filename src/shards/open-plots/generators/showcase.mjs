// OP5 (OPEN-PLOTS, last per G971): the Showcase Template, the template's worked example (OPEN-PLOTS §2: "the plot OP3's
// template emits with only shared families and one landmark"). It has no theme tiles of its own: every tile is one of
// Night Market's shared builders (houses, gardens, stalls, canals and their bends, forecourts, the plaza), retinted by the
// layout's palette into KITCHEN-SINK 19ab's polished warm orange and cool grey workshop look with cyan accents (orange tiled
// roofs, cream render, warm concrete, cyan canal light), round one landmark, the obelisk. A bright clear day: the shared
// builders' fireflies are dropped (fairground.mjs's morning writer) and birds drift over the gardens instead (bar 7).
import { pool } from './kit.mjs';
import { nightMarketBuilders } from './nightMarket.mjs';

/** The shared builders' fireflies (Glow with no green or blue, red in [0, 0.5)) blink to black, specks by day: a showcase
 *  tile's writer drops them and keeps everything else */
const noFireflies = (w) => new Proxy(w, { get: (target, key) => key === 'tri'
  ? (part, a, b, c, colour, ...rest) => (part === 'Glow' && colour?.[1] === 0 && colour?.[2] === 0 && colour[0] < 0.5 ? undefined : target.tri(part, a, b, c, colour, ...rest))
  : (typeof target[key] === 'function' ? target[key].bind(target) : target[key]) });

/** Life (bar 7): a bird, a 0.6 m mover in the glow graph's steady mode (red seed in [0.5, 1), no green: drifting slowly,
 *  never blinking to black) at full blue, which the graph lights white (Coral's gull, coral.mjs), over the gardens */
let seeds = 0;
function bird(w, x, y, z) {
  seeds++;
  const c = [((seeds * 0.6180339887) % 1) * 0.5 + 0.5, 0, 1], s = 0.6;
  const top = [x, y + s * 1.4, z], a = [x - s, y - s, z - s], b = [x + s, y - s, z - s], d = [x, y - s, z + s * 1.4];
  w.tri('Glow', top, b, a, c); w.tri('Glow', top, d, b, c); w.tri('Glow', top, a, d, c); w.tri('Glow', a, b, d, c);
}

/** The showcase's builders: a layout's shared letters (Night Market's kinds, `layout.builders`, all of them by default),
 *  every one drawn without fireflies, a pair of birds over each garden, and the shared lane seams. */
export function showcaseBuilders(letters) {
  const shared = nightMarketBuilders(letters);
  const day = Object.fromEntries(Object.entries(shared.tiles).map(([letter, tile]) => [letter, { ...tile, build: (w, p, variant) => {
    const lit = noFireflies(w);
    tile.build(lit, p, variant);
    if (letters?.[letter] === 'garden') for (const [x, y, z] of variant % 2 === 0 ? [[-8, 10, 6], [10, 13, -9]] : [[7, 11, 8], [-9, 12, -6]]) bird(lit, x, y, z);
  } }]));
  const seam = shared.seam === undefined ? undefined : (w, ...rest) => shared.seam(noFireflies(w), ...rest);
  return { tiles: day, coarseFamilies: shared.coarseFamilies, seam };
}

/** Hooks at the generic construction points (tiledPlotCore.mjs): the obelisk stands alone in its fountain ring on the
 *  plaza, a pale cyan pool of light round it. */
export const showcasePlot = {
  builders: layout => showcaseBuilders(layout.builders),
  lanternBake: { gain: 0.6, radius: 1.5, cut: 3 },
  ringInKit: true,
  models() { return undefined; },
  pools(parts, palette) {
    const lit = { Pool: parts.Pool }, plotWriter = { triColours: (part, a, b, c, colours) => lit[part].triColours(part, [a, b, c], colours) };
    pool(plotWriter, 0, 0, 18, palette.gatePool, 0.05);
  },
};
