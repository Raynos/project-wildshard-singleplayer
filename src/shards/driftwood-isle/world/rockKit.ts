/**
 * rockKit — Driftwood Isle's loose rocks (E114). The user, on the wreck and on Explore's Boulder: "Most low poly rocks
 * look like shit … way too basic. We need to try something else." Three directions were built; the user picked B,
 * SMOOTH PAINTED (2026-09-25), and it is the only look now (E136 removed the others and the old jittered icosahedra):
 * rounded Sea of Thieves / BotW boulders with SMOOTH normals — soft polytopes (broad faces, rounded edges) with fused
 * ledges, a dark wet foot → a lighter crown, crease / crack / contact AO, a moss cap with a tongued edge. Its own
 * material program (flatShading off). Built to art/rocks/round-2-b-final/.
 *
 *   const g = rockGeometry(r, rng, { squash: 0.62, palette: REEF_ROCK });   // non-indexed: position, normal, color
 *   g.applyMatrix4(m);                                                        // centred on the origin, ±r·squash tall
 *   new THREE.Mesh(g, rockMaterial(sky));                                     // merge many first: one draw
 *
 * Same convention as lowpolyKit's `rock()`: centred on the origin, about r wide and r·squash half-tall, so a caller keeps
 * its placement and colliders.
 */
import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import type { ModelPart } from '@wildshard/engine/models/model';
import { SHORE_ROCK } from '../data/rockProfiles';
import { bakedGeometry, withGeometryBake } from '@wildshard/engine/world/geometryBake';

type Sky = Parameters<typeof lowPolyLookMaterial>[0];

export interface RockOpts {
  /** vertical half-height ÷ r (default 0.7) */
  squash?: number;
  /** 0 = bare stone, 1 = a full moss cap (default 0.8) */
  moss?: number;
  /** default SHORE_ROCK */
  palette?: RockPalette;
  /** where the ground (or the water line) meets the rock, in its local y — the paint's foot → crown ramp and the
   * contact AO start there (default −0.3 · r · squash) */
  ground?: number;
  /** added to the icosphere detail of every piece (−1: a lighter rock for a dense scatter) */
  detail?: number;
}

/** the rocks' material: a smooth-shaded copy of the shared low-poly program (the rocks carry their own smooth normals,
 * so they don't merge into a flat-shaded LowPolyKit) */
export function rockMaterial(sky: Sky): THREE.Material {
  return lowPolyLookMaterial(sky, 'rock-smooth', (m) => { m.flatShading = false; m.roughness = 0.82; });
}

/** a palette's bake id: the rock's id and every colour, so a palette edit is a different key */
const paletteIds = new WeakMap<RockPalette, string>();
function rockBakeId(pal: RockPalette): string {
  let id = paletteIds.get(pal);
  if (id === undefined) { id = `driftwood-isle/rock:${Object.values(pal).join(',')}`; paletteIds.set(pal, id); }
  return id;
}

/** one rock — non-indexed, with `position`, `normal` and `color`. Built at `wildshard build` time and read back at load
 *  (SF67: src/engine/world/geometryBake.ts, scripts/bake-geometry.mjs); a missing required recipe refuses */
export function rockGeometry(r: number, rng: Rng, o: RockOpts = {}): THREE.BufferGeometry {
  const sq = o.squash ?? 0.7, moss = o.moss ?? 0.8, palette = o.palette ?? SHORE_ROCK, ground = o.ground ?? -0.3 * r * sq, detail = o.detail ?? 0;
  // the bake holds the welded, painted pieces (position, colour, index: a sixth of the finished rock's bytes); the rest is
  // exact arithmetic (no Math.sin / exp: the same bits on every engine), so it runs at load
  return finishRock(bakedGeometry(rockBakeId(palette), [r, sq, moss, ground, detail], rng, () => { throw new Error(`Required baked rock is missing: ${rockBakeId(palette)}`); }));
}



/** a rock kind's paint (sRGB hex; lerped in linear) */
export interface RockPalette {
  /** the stone ramp: the wet foot → the shade → the body → the sunlit crown */
  foot: string; dark: string; mid: string; light: string;
  /** the worn convex edges */
  edge: string;
  /** broad warm / cool drifts across a rock */
  warm: string; cool: string;
  /** the tint that creases, cracks and AO fall toward */
  crease: string;
  moss: string; mossLight: string; mossDark: string;
  /** the wet line at the foot */
  wet: string;
}

/** Borrow the table only while building an Explorer card, then release its bytes. */
export function rockSpecimen(id: string, size: readonly [number, number, number], build: () => readonly ModelPart[]): THREE.Group {
  return loadingSpecimen(id, size, () => withGeometryBake('/assets/models/driftwood-blender/geometry.bin', () => {
    const root = new THREE.Group();
    for (const part of build()) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.castShadow = part.castShadow ?? false;
      mesh.receiveShadow = part.receiveShadow ?? false;
      root.add(mesh);
    }
    return Promise.resolve(root);
  }));
}

/** how far the smooth normals lean toward each triangle's own normal: 0 = fully smooth, 1 = faceted. A touch keeps the
 * painted planes of the mockup readable without going back to the crumpled-paper facets */
const FACET_HINT = 0.3;
function facetHint(g: THREE.BufferGeometry, f: number): void {
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(a.sub(b)).normalize();
    for (let j = 0; j < 3; j++) { n.fromBufferAttribute(nrm, i + j).multiplyScalar(1 - f).addScaledVector(fn, f).normalize(); nrm.setXYZ(i + j, n.x, n.y, n.z); }
  }
}

/** the welded, painted pieces → the finished rock: smooth normals per piece, unwelded, the facet hint */
export function finishRock(welded: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', welded.getAttribute('position'));
  g.setIndex(welded.getIndex());
  g.computeVertexNormals();
  g.setAttribute('color', welded.getAttribute('color'));
  const ni = g.toNonIndexed();
  g.dispose(); welded.dispose();
  facetHint(ni, FACET_HINT);
  return ni;
}

