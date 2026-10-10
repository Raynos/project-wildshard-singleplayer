/**
 * The zipline landing and the creek footbridge built (E315 M2; PINE-HOLLOW-REMASTER PH-B3; G285: an offline bake), on the
 * cabins' timber kit (../world/timber.ts). Build-time only: `scripts/bake-pine-site-timbers.mjs` runs `bakeSiteTimbers`
 * over Pine Hollow's baked terrain (the page's own grid), and writes what each builder leaves, at its site and on the
 * turntable's flat ground, to `public/assets/pine-hollow/baked/site-timbers.bin` + `../data/siteTimbers.json`; the page
 * finishes the timbers from them (../world/timberSites.ts) and never runs this. test/shards/pine-hollow/site-timbers-bake.test.ts
 * is the stale gate. Each timber's stream is the level seed's (1337, the page's engine SEED while the landmarks build).
 *
 * The landing: a 3 m deck on log posts over the N road, X-braced along the road's sides, a railing, the gantry with the
 * cable's anchor and the buffer block the trolley meets, and a stair down off its -X side with as many risers as the
 * ground asks; its frame: local +Z faces up the cable, the origin on the ground. The footbridge: two bark stringer logs,
 * a split-plank deck, log trestles in the gully, cribbed abutments and a log handrail; its frame: along local X (the
 * road), the origin midway between its ends. Each fits its site: `g` is the ground under own (x, z), relative to the origin.
 */
import type * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { ZIPLINE } from '../layout';
import { Timber, V } from '../world/timber';
import { BRIDGE, BRIDGE_HALF, LANDING, bridgeSite, landingSite, type SiteTimberRows } from '../world/timberSites';
import { TimberRecorder } from './timberBake';

type V3 = THREE.Vector3;
type Ground = (lx: number, lz: number) => number;

const LANDING_DIMS = { hx: 1.5, hz: 1.6, deck: ZIPLINE.to.deck, gantry: 3.8, cable: 3.3 };

function buildLanding(t: Timber, g: (lx: number, lz: number) => number): void {
  // the N road runs under the deck along local Z (the cable's line): the posts stand 3 m apart either side of it, the
  // X-bracing is on the road's sides only, and the stair comes down off the −X side, away from the road
  const { hx, hz, deck } = LANDING_DIMS;
  const posts: [number, number][] = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]];
  for (const [px, pz] of posts) {
    t.log(V(px, g(px, pz) - 0.35, pz), V(px, deck + 1.05, pz), 0.15);
    t.solid(px, pz, 0.16, 0.16, g(px, pz) - 0.3, deck + 1.05);
  }
  for (const sx of [-1, 1]) {
    const x = sx * hx, ga = g(x, hz) + 0.35, gb = g(x, -hz) + 0.35;
    t.log(V(x, ga, hz), V(x, deck - 0.3, -hz), 0.07);
    t.log(V(x, gb, -hz), V(x, deck - 0.3, hz), 0.07);
    t.log(V(x, deck - 0.12, -hz - 0.2), V(x, deck - 0.12, hz + 0.2), 0.12);       // the beams the joists sit on
  }
  for (let i = 0; i < 4; i++) { const z = -hz + (i / 3) * hz * 2; t.box('beam', hx * 2 + 0.3, 0.16, 0.12, 0, deck - 0.2, z, 1); }
  t.box('deck', hx * 2 + 0.3, 0.07, hz * 2 + 0.3, 0, deck - 0.035, 0, 1.2);
  t.solid(0, 0, hx + 0.15, hz + 0.15, deck - 0.25, deck);
  t.floor(0, 0, hx + 0.15, hz + 0.15, deck);
  // rails: the +X side whole, the −X side either side of the stair's gap, the −Z end whole (the +Z end is the arrival)
  const rail = (a: V3, b: V3): void => {
    t.beam(V(a.x, deck + 1.0, a.z), V(b.x, deck + 1.0, b.z), 0.08);
    t.beam(V(a.x, deck + 0.5, a.z), V(b.x, deck + 0.5, b.z), 0.06);
    const c = a.clone().lerp(b, 0.5), len = a.distanceTo(b) / 2;
    if (Math.abs(a.x - b.x) > Math.abs(a.z - b.z)) t.solid(c.x, c.z, len, 0.05, deck, deck + 1.05); else t.solid(c.x, c.z, 0.05, len, deck, deck + 1.05);
  };
  const gap = 0.6;
  rail(V(hx, 0, -hz), V(hx, 0, hz));
  rail(V(-hx, 0, -hz), V(-hx, 0, -gap));
  rail(V(-hx, 0, gap), V(-hx, 0, hz));
  rail(V(-hx, 0, -hz), V(hx, 0, -hz));
  // the gantry: two posts at the +Z edge, a cross log, the cable's anchor + the buffer block the trolley meets
  for (const sx of [-1, 1]) t.log(V(sx * (hx - 0.2), deck - 0.3, hz + 0.05), V(sx * (hx - 0.2), deck + LANDING_DIMS.gantry, hz + 0.05), 0.12);
  t.log(V(-hx - 0.1, deck + LANDING_DIMS.gantry - 0.2, hz + 0.05), V(hx + 0.1, deck + LANDING_DIMS.gantry - 0.2, hz + 0.05), 0.11);
  t.box('iron', 0.18, 0.28, 0.12, 0, deck + LANDING_DIMS.cable + 0.08, hz + 0.05, 1);
  t.box('beam', 0.5, 0.7, 0.3, 0, deck + LANDING_DIMS.cable - 0.9, hz - 0.1, 1);
  // the stair down off the −X side: as many risers as the ground asks (≤ 0.33 m each), 0.38 m treads
  const gFoot0 = g(-hx - 3.4, 0);
  const count = Math.max(3, Math.ceil((deck - gFoot0) / 0.33)), run = count * 0.38;
  const xTop = -hx - 0.15, xFoot = xTop - run, gf = g(xFoot, 0);
  t.treads(V(xFoot, gf, 0), V(xTop, deck, 0), 1.1, count);
  for (let i = 0; i < count - 1; i++) t.box('deck', 0.42, 0.05, 1.1, xFoot + 0.38 * (i + 0.5), gf + (deck - gf) * ((i + 1) / count) - 0.025, 0, 1.2);
  for (const sz of [-gap, gap]) {
    t.beam(V(xFoot, gf, sz), V(xTop, deck - 0.05, sz), 0.08);
    t.beam(V(xFoot + 0.2, gf + 0.95, sz), V(xTop, deck + 0.95, sz), 0.06);
    t.beam(V(xFoot + 0.2, gf - 0.2, sz), V(xFoot + 0.2, gf + 1.0, sz), 0.08);
    t.solidAlong(V(xFoot + 0.2, gf + 0.6, sz * 1.08), V(xTop, deck + 0.6, sz * 1.08), 0.04, 0.5);
  }
  t.anchors['zipBottom'] = V(0, deck + LANDING_DIMS.cable, hz + 0.05); t.anchors['landing'] = V(0, deck, 0);
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

/** the ground under a timber's own (x, z), relative to its frame's height (the page's heights at the site) */
function siteGround(frame: THREE.Matrix4, y: number): Ground {
  return (lx, lz) => { const w = V(lx, 0, lz).applyMatrix4(frame); return heightAt(w.x, w.z) - y; };
}

/** The bake: each timber at its site and on the turntable (the landing on flat ground, the bridge 1.2 m over its gully). */
export function bakeSiteTimbers(): { bin: Uint8Array; rows: Omit<SiteTimberRows, 'bin' | 'bytes'> } {
  const recorder = new TimberRecorder();
  const landing = (g: Ground): ReturnType<TimberRecorder['record']> => { const t = new Timber(LANDING.name, LANDING.seed); buildLanding(t, g); return recorder.record(t); };
  const bridge = (g: Ground): ReturnType<TimberRecorder['record']> => { const t = new Timber(BRIDGE.name, BRIDGE.seed); buildBridge(t, BRIDGE_HALF, g); return recorder.record(t); };
  const ls = landingSite(), bs = bridgeSite();
  const rows = {
    seed: SEED,
    landing: { world: landing(siteGround(ls.at, ls.y)), turntable: landing(() => 0) },
    bridge: { world: bridge(siteGround(bs.at, bs.y)), turntable: bridge(() => -1.2) },
  };
  return { bin: recorder.bin(), rows };
}
