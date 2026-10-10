import { Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { facetedGeometry, fitModel } from '@wildshard/sdk/looks/modelIntake';
import { FALLEN_BRIDGE, SPANS, type Span } from '../data/layout';
import { ropeSag } from '../layout';
import { RISING_ISLETS } from '../world/islets';
import { SKY_AO_FLOOR } from '../world/meshes';
import { skyMeshUrl } from '../boot/files';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): Sky Reach's rope bridges, baked by `scripts/bake-sky-world.mjs` into
 * `baked/bridges.bin` (a deflated `@wildshard/sdk/kit/geometryPack`) + `data/bridges.json`; the client (world/shapes.ts
 * `ropeBridge`) draws each span from its record in its own materials. Every rope span is baked as the page built it: the
 * generated deck segment (Hunyuan3D-2, `art/far-reach/round-9-bridge/`) fitted and greyed once, stretched per span and laid
 * along the rope sag; the textured anchor posts' places at the four corners; the hand ropes' control points; the ties'.
 */

/** The rope-bridge kit: a plank deck segment about this long. */
const DECK_SEGMENT = 4.8;
/** How far the textured anchor post's middle stands outside the rope rails (half its stone footing). */
const POST_OUT = 0.3;
const ONE = new Vector3(1, 1, 1);
/** A span's length along its slope (as world/build.ts `spanLength`). */
const spanLength = (span: Span): number => Math.hypot(span.x1 - span.x0, span.y1 - span.y, span.z1 - span.z0);

/** A hand rope: its tube radius and its control points, flat (x, y, and the distance along the span s: z is −s). */
export interface BakedRope { r: number; at: number[] }
/**
 * One baked span: its deck (the shared segment's stretch and its instance matrices, a float block of the pack), its posts'
 * matrices (a float block), and per side its two ropes and its ties (flat: x, the middle's y, the distance along the span
 * t with z = −t, and the height).
 */
export interface BakedBridge {
  id: string; deck: { scale: [number, number, number]; at: number }; posts: number;
  sides: { top: BakedRope; mid: BakedRope; ties: number[] }[];
}
/** The bridges' rows: the pack's, the deck segment's geometry and the spans. */
export interface BridgeRows extends PackedGeometryRows { deck: number; spans: BakedBridge[] }

/** The plank's tilt at `s` along the sag: its forward end follows the curve down then up. */
function sagTilt(sag: (s: number) => number, s: number): Quaternion {
  const ds = 0.05, slope = (sag(s + ds) - sag(s - ds)) / (2 * ds);
  return new Quaternion().setFromEuler(new Euler(-Math.atan(slope), 0, 0));
}
/** A rope hung `at` metres over the deck line at `x`, sagging `k` times the deck's sag: its tube's control points. */
function hungRope(length: number, sag: (s: number) => number, x: number, at: number, k: number, radius: number): BakedRope {
  const pts: number[] = [];
  for (let i = 0; i <= 16; i++) { const s = (i / 16) * length; pts.push(x, at - sag(s) * k, s); }
  return { r: radius, at: pts };
}
/** Weathered wood (E392: the targets' planks are silver-grey-brown): the geometry's vertex colours pulled most of the way to their grey. */
function greyWood(g: BufferGeometry): BufferGeometry {
  if (!g.hasAttribute('color')) return g;
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) {
    const r = c.getX(i), gg = c.getY(i), b = c.getZ(i), lum = r * 0.3 + gg * 0.59 + b * 0.11;
    c.setXYZ(i, r + (lum * 1.04 - r) * 0.65, gg + (lum * 0.99 - gg) * 0.65, b + (lum * 0.92 - b) * 0.65);
  }
  c.needsUpdate = true; return g;
}
/** An instanced mesh's matrices as the page's instance buffer holds them. */
const matrices = (mesh: InstancedMesh): Float32Array => Float32Array.from(mesh.instanceMatrix.array);

/**
 * The generated deck segment fitted along its long axis (x), turned so that axis runs down the span, centred with its top
 * at y 0 and greyed (the segment every span stretches), and its box's extent.
 */
function deckSegment(source: BufferGeometry): { geometry: BufferGeometry; x: number; z: number } {
  const g = fitModel(source, { size: DECK_SEGMENT, by: 'span', floor: 0 }); g.rotateY(Math.PI / 2); g.computeBoundingBox();
  const b = g.boundingBox; if (b === null) throw new Error('far-reach bridges: the deck has no box');
  g.translate(-(b.min.x + b.max.x) / 2, -b.max.y, -(b.min.z + b.max.z) / 2);
  // weathered wood (E392: the mockups' planks are grey-brown, ours read saturated orange); the page recomputes the normals
  greyWood(g); g.deleteAttribute('normal');
  return { geometry: g, x: b.max.x - b.min.x, z: b.max.z - b.min.z };
}
/** A span's deck: the segment's stretch to the span's width and its share of the length, and the segments along the sag. */
function kitDeck(extent: { x: number; z: number }, length: number, width: number, sag: (s: number) => number): { scale: [number, number, number]; at: Float32Array } {
  const n = Math.max(1, Math.round(length / DECK_SEGMENT)), seg = length / n;
  // (round 6, seat A: 'thinner plank wedges'; the seats: 'a solid dark near edge'): half the kit's plank depth, the walking top unchanged
  const scale: [number, number, number] = [width / Math.max(1e-3, extent.x), 0.5, seg / Math.max(1e-3, extent.z)];
  const mesh = new InstancedMesh(undefined, new MeshStandardMaterial(), n), m = new Matrix4();
  for (let i = 0; i < n; i++) { const s = (i + 0.5) * seg; m.compose(new Vector3(0, -sag(s), -s), sagTilt(sag, s), ONE); mesh.setMatrixAt(i, m); }
  return { scale, at: matrices(mesh) };
}
/** The textured posts at the span's four corners, their hanging rope ends turned outward. */
function postMatrices(width: number, length: number): Float32Array {
  const mesh = new InstancedMesh(undefined, undefined, 4), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  let i = 0;
  for (const side of [-1, 1]) for (const z of [0, -length]) {
    // the file's knot hangs on its +x side: turned so it hangs on the post's outer side either way
    q.setFromAxisAngle(up, side > 0 ? 0 : Math.PI);
    m.compose(new Vector3(side * (width / 2 + POST_OUT), -0.05, z), q, ONE); mesh.setMatrixAt(i++, m);
  }
  return matrices(mesh);
}

/** The spans the page lays as rope bridges: the rope SPANS, each gate isle's bridge, the fallen crown bridge (rigid) and the Explorer's kit. */
export function ropeSpans(): { id: string; length: number; width: number; hangs: boolean }[] {
  return [...SPANS.filter((span) => span.kind === 'rope'), ...RISING_ISLETS.map((entry) => entry.bridge)].map((span) => ({ id: span.id, length: spanLength(span), width: span.width, hangs: true }))
    .concat([{ id: FALLEN_BRIDGE.id, length: spanLength(FALLEN_BRIDGE), width: FALLEN_BRIDGE.width, hangs: false }, { id: 'kit', length: DECK_SEGMENT, width: 2.6, hangs: true }]);
}

/**
 * Every rope span from the kit's deck model (`read` returns a public file's bytes): the binary (uncompressed; the script
 * deflates it) and its rows.
 */
export async function bakeSkyBridges(read: (url: string) => Uint8Array): Promise<{ bin: Uint8Array; rows: BridgeRows }> {
  const deckModel = facetedGeometry((await readSourceModel(read(skyMeshUrl('bridge-deck')))).gltf.scene, SKY_AO_FLOOR);
  if (deckModel === null) throw new Error('far-reach bridges: the deck model has no mesh');
  const pack = new GeometryPackWriter('far-reach bridges'), segment = deckSegment(deckModel), deck = pack.add(segment.geometry);
  const spans = ropeSpans().map(({ id, length, width, hangs }): BakedBridge => {
    // a rigid deck (the crown's drawbridge swings up whole) does not sag
    const sag = (s: number): number => hangs ? ropeSag(length, s) : 0;
    const sides = [-1, 1].map((side) => {
      // the hand ropes (E399 round 6, seat A: 'tied rails'): a thick top rope from the post heads, drawn tighter than the
      // deck, a lighter mid rope, and thin ties from the top rope down to the deck's edge every 2.5 m (round 7, seat B)
      const x = side * width / 2, topAt = 1.45, topK = 0.7, ties: number[] = [];
      for (let t = 2.5; t < length - 1.2; t += 2.5) { const deckY = -sag(t), ropeY = topAt - sag(t) * topK; ties.push(x, (ropeY + deckY) / 2, t, ropeY - deckY); }
      return { top: hungRope(length, sag, x, topAt, topK, 0.045), mid: hungRope(length, sag, x, 0.7, 0.88, 0.026), ties };
    });
    const { scale, at } = kitDeck(segment, length, width, sag);
    return { id, deck: { scale, at: pack.addFloats(at, 16) }, posts: pack.addFloats(postMatrices(width, length), 16), sides };
  });
  return { bin: pack.bytes(), rows: { ...pack.rows(), deck, spans } };
}
