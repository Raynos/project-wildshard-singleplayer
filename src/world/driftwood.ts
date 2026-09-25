/**
 * Driftwood logs (E149): the one painter every beached log on Driftwood Isle goes through (the wreck's piles in
 * Wreck.ts, the dune-line logs in GroundCover.ts), so they read as sun-bleached, weathered wood and not as white
 * styrofoam under the midday sun (phone audit T3: the old `#d2c6ae` / `#e2d8c4` blew out to near-white).
 *
 *   addDriftLog(kit, a, b, r0, r1, { sides: 7, twist, tone: k, wobble: 0.03 });
 *
 * Still faceted and flat-shaded, one colour per facet:
 *   · the body is a warm silver-brown, ~20 % darker than before, in three tones (`tone` picks one per log);
 *   · each facet leans a little toward silver-grey (the sun-bleached top) or toward brown (the weathered underside),
 *     plus a lightness jitter, so a log is not one flat colour;
 *   · ~1 facet in 8 is a crack: a dark split running the length of the log;
 *   · the two end caps are dark end grain.
 */
import * as THREE from 'three';
import { log, wobble, type LowPolyKit } from './lowpolyKit';

/** the body tones (one per log), the facet leans, the crack and the end grain */
export const DRIFT = {
  tones: ['#ab9d85', '#9d8e75', '#b4a894'],
  silver: new THREE.Color('#b2a998'),
  brown: new THREE.Color('#86735a'),
  crack: new THREE.Color('#5f5040'),
  end: new THREE.Color('#6a5844'),
  /** a snapped branch stub */
  stub: '#978870',
} as const;

export interface DriftLogOpts {
  sides?: number;
  twist?: number;
  /** which body tone (index into DRIFT.tones, wraps) */
  tone?: number;
  /** a colour for the body instead of a tone */
  color?: THREE.ColorRepresentation;
  /** random per-vertex displacement, m */
  wobble?: number;
  /** per-facet lightness jitter, ± fraction */
  jitter?: number;
  /** chance a facet is a crack (default 0.12) */
  cracks?: number;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _axis = new THREE.Vector3();
const _body = new THREE.Color(), _facet = new THREE.Color();

/** a faceted driftwood log from a to b (radius r0 → r1), painted per facet, added to the kit */
export function addDriftLog(kit: LowPolyKit, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, o: DriftLogOpts = {}): void {
  const rng = kit.rng, jitter = o.jitter ?? 0.07, cracks = o.cracks ?? 0.12;
  const g = log(a, b, r0, r1, o.sides ?? 6, o.twist ?? 0);
  if (o.wobble !== undefined && o.wobble > 0) wobble(g, o.wobble, rng);
  const ni = g.index ? g.toNonIndexed() : g;
  if (ni !== g) g.dispose();
  if (ni.hasAttribute('uv')) ni.deleteAttribute('uv');
  if (ni.hasAttribute('normal')) ni.deleteAttribute('normal');
  _body.set(o.color ?? DRIFT.tones[(((o.tone ?? 0) % 3) + 3) % 3] ?? DRIFT.tones[0]);
  _axis.subVectors(b, a).normalize();
  const pos = ni.getAttribute('position'), n = pos.count, out = new Float32Array(n * 3);
  // CylinderGeometry lays the side out first, two triangles per facet, then the caps: re-roll the colour per facet
  let side = 0;
  for (let i = 0; i < n; i += 3) {
    _a.fromBufferAttribute(pos, i); _b.fromBufferAttribute(pos, i + 1); _c.fromBufferAttribute(pos, i + 2);
    _b.sub(_a); _c.sub(_a); _b.cross(_c).normalize();
    if (Math.abs(_b.dot(_axis)) > 0.8) {
      _facet.copy(DRIFT.end).multiplyScalar(0.9 + rng.next() * 0.2);             // end grain
    } else {
      if (side % 2 === 0) {
        const v = rng.next();
        if (v < cracks) _facet.copy(DRIFT.crack);
        else {
          // the upward facets bleach toward silver, the downward ones weather toward brown, plus a random lean
          const lean = _b.y * 0.35 + (rng.next() - 0.5) * 0.5;
          _facet.copy(_body).lerp(lean > 0 ? DRIFT.silver : DRIFT.brown, Math.min(0.6, Math.abs(lean)));
        }
        _facet.multiplyScalar(1 - jitter + rng.next() * jitter * 2);
      }
      side++;
    }
    for (let j = 0; j < 3; j++) { const k = (i + j) * 3; out[k] = _facet.r; out[k + 1] = _facet.g; out[k + 2] = _facet.b; }
  }
  ni.setAttribute('color', new THREE.BufferAttribute(out, 3));
  kit.addPainted(ni);
}
