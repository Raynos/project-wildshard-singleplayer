/**
 * The zipline landing (E315 M2; PINE-HOLLOW-REMASTER PH-B3), built in code on the cabins' timber kit
 * (../world/timber.ts): a 3 m deck on log posts over the N road, X-braced along the road's sides, a railing, the
 * gantry with the cable's anchor and the buffer block the trolley meets, and a stair down off its −X side with as many
 * risers as the ground asks. Its frame: local +Z faces up the cable; the origin on the ground. Fitted to its site: its
 * posts, bracing and stair foot reach the ground under them (`ground`, own space, relative to the origin).
 * Placed once in the Hollow (src/shards/pine-hollow/world/landmarks.ts); its anchors (`zipBottom`, `landing`) are the ride's.
 */
import type * as THREE from 'three';
import { ZIPLINE } from '../layout';
import { defineModel } from '@wildshard/engine/models/model';
import { Timber, V, timberFacts, timberMats } from '../world/timber';

type V3 = THREE.Vector3;

const LANDING = { hx: 1.5, hz: 1.6, deck: ZIPLINE.to.deck, gantry: 3.8, cable: 3.3 };

export interface ZiplineLandingParams {
  /** the ground's height under own (x, z), relative to the origin (flat on the turntable) */
  readonly ground: (lx: number, lz: number) => number;
}

function buildLanding(t: Timber, g: (lx: number, lz: number) => number): void {
  // the N road runs under the deck along local Z (the cable's line): the posts stand 3 m apart either side of it, the
  // X-bracing is on the road's sides only, and the stair comes down off the −X side, away from the road
  const { hx, hz, deck } = LANDING;
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
  for (const sx of [-1, 1]) t.log(V(sx * (hx - 0.2), deck - 0.3, hz + 0.05), V(sx * (hx - 0.2), deck + LANDING.gantry, hz + 0.05), 0.12);
  t.log(V(-hx - 0.1, deck + LANDING.gantry - 0.2, hz + 0.05), V(hx + 0.1, deck + LANDING.gantry - 0.2, hz + 0.05), 0.11);
  t.box('iron', 0.18, 0.28, 0.12, 0, deck + LANDING.cable + 0.08, hz + 0.05, 1);
  t.box('beam', 0.5, 0.7, 0.3, 0, deck + LANDING.cable - 0.9, hz - 0.1, 1);
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
  t.anchors['zipBottom'] = V(0, deck + LANDING.cable, hz + 0.05); t.anchors['landing'] = V(0, deck, 0);
}

const landing = timberFacts<ZiplineLandingParams>((ctx, p) => {
  const t = new Timber('zipline-landing', 902);
  buildLanding(t, p.ground);
  t.finish(timberMats(ctx), 4);
  return t;
}, (p) => p.ground);

export const ziplineLanding = defineModel<ZiplineLandingParams>({
  id: 'pine-hollow/zipline-landing', name: 'Zipline landing', category: 'buildings', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/ziplineLanding.ts', surface: 'wood',
  defaults: { ground: () => 0 },
  build: (ctx, p) => landing.build(ctx, p),
  colliders: (p, ctx) => landing.facts(ctx, p).colliders,
});

/** its deck floor and its anchors (`zipBottom`: the cable's end, `landing`: where the ride sets you down), own space */
export const ziplineLandingFacts = landing.facts;
