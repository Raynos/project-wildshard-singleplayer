/**
 * The creek footbridge (E315 M2; PINE-HOLLOW-REMASTER PH-B3), built in code on the cabins' timber kit
 * (../world/timber.ts): two bark stringer logs, a split-plank deck, log trestles in the gully, cribbed abutments and a
 * log handrail. Its frame: along local X (the road), the origin midway between its ends. Fitted to its site: the deck
 * runs from one bank to the other and the trestles reach the gully's floor (`ground`, own space, relative to the
 * origin). Placed once where the E road crosses the creek (src/shards/pine-hollow/world/landmarks.ts).
 */
import { defineModel } from '@wildshard/engine/models/model';
import { Timber, V, timberFacts, timberMats } from '../world/timber';


export interface CreekFootbridgeParams {
  /** half its length (m) */
  readonly half: number;
  /** the ground's height under own (x, z), relative to the origin (flat on the turntable) */
  readonly ground: (lx: number, lz: number) => number;
}

function buildBridge(t: Timber, half: number, g: (lx: number, lz: number) => number): void {
  const yA = g(-half, 0) + 0.25, yB = g(half, 0) + 0.25;
  const deckAt = (s: number): number => yA + (yB - yA) * ((s + half) / (half * 2));
  const W = 1.9;
  // two stringer logs, split-plank deck across them
  for (const z of [-0.55, 0.55]) t.log(V(-half - 0.3, deckAt(-half) - 0.3, z), V(half + 0.3, deckAt(half) - 0.3, z), 0.22, 'bark', 12);
  const n = Math.round((half * 2) / 0.27);
  for (let i = 0; i < n; i++) {
    const s = -half + (i + 0.5) * ((half * 2) / n);
    t.box('deck', 0.25, 0.08, W + t.rng.range(-0.1, 0.1), s, deckAt(s) - 0.04, t.rng.range(-0.04, 0.04), 1.2, t.rng.range(-0.03, 0.03));
  }
  // the deck's collider: one box along the slope
  t.solidAlong(V(-half, deckAt(-half) - 0.1, 0), V(half, deckAt(half) - 0.1, 0), W / 2, 0.1);
  t.floor(0, 0, half, W / 2, (yA + yB) / 2);
  // trestles in the gully (where the ground falls a metre or more below the stringers)
  for (const s of [-8, -2.5, 3, 8.5]) {
    const top = deckAt(s) - 0.52, gl = Math.min(g(s, -0.7), g(s, 0.7));
    if (top - gl < 0.8) continue;
    for (const z of [-0.7, 0.7]) { t.log(V(s, gl - 0.4, z * 1.25), V(s, top, z), 0.14, 'bark'); t.solid(s, z * 1.1, 0.16, 0.16, gl - 0.4, top); }
    t.log(V(s, top - 0.05, -1.05), V(s, top - 0.05, 1.05), 0.13, 'bark');
    if (top - gl > 2.2) { t.log(V(s, gl + 0.5, -0.85), V(s, top - 0.3, 0.75), 0.07, 'bark'); t.log(V(s, gl + 0.5, 0.85), V(s, top - 0.3, -0.75), 0.07, 'bark'); }
  }
  // abutments: a crib of cross logs under each end
  for (const [s, y] of [[-half, yA], [half, yB]] as const) for (let k = 0; k < 2; k++) t.log(V(s + (s < 0 ? 0.3 : -0.3) * k, y - 0.55 - k * 0.3, -1.2), V(s + (s < 0 ? 0.3 : -0.3) * k, y - 0.55 - k * 0.3, 1.2), 0.16, 'bark');
  // the handrails: log posts every ~3 m on both sides, a peeled log rail
  const m = Math.round((half * 2) / 3);
  for (const z of [-W / 2 - 0.05, W / 2 + 0.05]) {
    for (let i = 0; i <= m; i++) { const s = -half + 0.2 + (i / m) * (half * 2 - 0.4); t.log(V(s, deckAt(s) - 0.35, z), V(s, deckAt(s) + 1.0, z), 0.07); }
    t.log(V(-half + 0.1, deckAt(-half) + 0.95, z), V(half - 0.1, deckAt(half) + 0.95, z), 0.06);
    t.solidAlong(V(-half, deckAt(-half) + 0.5, z), V(half, deckAt(half) + 0.5, z), 0.05, 0.55);
  }
}

const footbridge = timberFacts<CreekFootbridgeParams>((ctx, p) => {
  const t = new Timber('creek-footbridge', 903);
  buildBridge(t, p.half, p.ground);
  t.finish(timberMats(ctx), p.half);
  return t;
}, (p) => p.ground);

export const creekFootbridge = defineModel<CreekFootbridgeParams>({
  id: 'pine-hollow/creek-footbridge', name: 'Creek footbridge', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/creekFootbridge.ts', surface: 'wood',
  defaults: { half: 12, ground: () => -1.2 },
  build: (ctx, p) => footbridge.build(ctx, p),
  colliders: (p, ctx) => footbridge.facts(ctx, p).colliders,
});

/** its deck floor, own space */
export const creekFootbridgeFacts = footbridge.facts;
