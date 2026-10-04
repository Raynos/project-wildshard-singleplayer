import type { ColliderDesc, Piece } from '@wildshard/engine/world/registry';
import { BufferGeometry, Color, Float32BufferAttribute, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { ENTRY_RAMPS, SWITCHBACK, TOWER, type EntryRamp, type LandingBox, type P3, type Slab } from './ramps';
import { STRINGS } from '../strings';
import { PALETTE, flat } from './shapes';

const FILE = 'src/shards/far-reach/world/entries.ts';
/** A slab's frame (spanBox's convention): local −Z runs a→b, +Y is the deck's up. */
function frame(slab: Slab): { q: Quaternion; length: number; up: Vector3 } {
  const dx = slab.b.x - slab.a.x, dy = slab.b.y - slab.a.y, dz = slab.b.z - slab.a.z, flatRun = Math.hypot(dx, dz);
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, flatRun);
  const q = new Quaternion(Math.cos(yaw / 2) * Math.sin(pitch / 2), Math.sin(yaw / 2) * Math.cos(pitch / 2), -Math.sin(yaw / 2) * Math.sin(pitch / 2), Math.cos(yaw / 2) * Math.cos(pitch / 2));
  return { q, length: Math.hypot(flatRun, dy), up: new Vector3(0, 1, 0).applyQuaternion(q) };
}
/** A deck's top or a rail's foot is the slab's line: the box sits under a deck, over a rail. */
const span = (slab: Slab): readonly [number, number] => slab.role === 'deck' ? [-SWITCHBACK.deck, 0] : [0, SWITCHBACK.rail];
export function slabCollider(slab: Slab): ColliderDesc {
  const { q, length, up } = frame(slab), [lo, hi] = span(slab), lift = (lo + hi) / 2;
  return { kind: 'box', x: (slab.a.x + slab.b.x) / 2 + up.x * lift, y: (slab.a.y + slab.b.y) / 2 + up.y * lift, z: (slab.a.z + slab.b.z) / 2 + up.z * lift,
    hx: slab.width / 2, hy: (hi - lo) / 2, hz: length / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface: 'wood' };
}
/** Every collider of one entry: the declared landing exactly as the shardfile states it, then the decks and rails. */
export function entryColliders(entry: EntryRamp): ColliderDesc[] {
  const l: LandingBox = entry.landing;
  return [{ kind: 'box', x: l.x, y: l.y, z: l.z, hx: l.hx, hy: l.hy, hz: l.hz, surface: l.surface }, ...entry.slabs.map(slabCollider)];
}

/** One vertex-coloured, flat-shaded geometry of oriented boxes (one draw per entry). */
class Boxes {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly c = new Color();
  private readonly m = new Matrix4();
  private readonly v = new Vector3();
  /** a box `w` × `h` × `d` (local x, y, z) at `centre`, turned by `q`, in `color` lightened / darkened by `shade` */
  box(centre: Vector3, q: Quaternion, w: number, h: number, d: number, color: number, shade = 1): void {
    this.m.compose(centre, q, new Vector3(w / 2, h / 2, d / 2));
    this.c.setHex(color).multiplyScalar(shade);
    const corner = (i: number): Vector3 => this.v.set((i & 1) === 0 ? -1 : 1, (i & 2) === 0 ? -1 : 1, (i & 4) === 0 ? -1 : 1).applyMatrix4(this.m).clone();
    const p = Array.from({ length: 8 }, (_, i) => corner(i));
    for (const [i0, i1, i2, i3] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]] as const) {
      for (const i of [i0, i1, i2, i0, i2, i3]) { const v = p[i]; if (v === undefined) throw new Error('Missing box corner'); this.pos.push(v.x, v.y, v.z); this.col.push(this.c.r, this.c.g, this.c.b); }
    }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
}

const PLANK = 0.62, POST_EVERY = 2.4;
/** A deck drawn as cross planks on two stringers; a rail as posts with a top and a middle rope (the rope bridges' look). */
function drawSlab(out: Boxes, slab: Slab, seed: number): void {
  const { q, length, up } = frame(slab), a = new Vector3(slab.a.x, slab.a.y, slab.a.z), dir = new Vector3(slab.b.x, slab.b.y, slab.b.z).sub(a).normalize();
  const along = (s: number, lift: number): Vector3 => a.clone().addScaledVector(dir, s).addScaledVector(up, lift);
  if (slab.role === 'deck') {
    const n = Math.max(1, Math.round(length / PLANK));
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * (length / n), shade = 0.9 + 0.2 * Math.abs(Math.sin((seed + i) * 12.9898) * 0.5);
      out.box(along(s, -0.05), q, slab.width, 0.1, (length / n) * 0.86, PALETTE.plank, shade);
    }
    const side = new Vector3(1, 0, 0).applyQuaternion(q);
    for (const k of [-1, 1]) out.box(along(length / 2, -0.2).addScaledVector(side, k * (slab.width / 2 - 0.15)), q, 0.18, 0.22, length, PALETTE.trunk);
    return;
  }
  const n = Math.max(1, Math.ceil(length / POST_EVERY));
  for (let i = 0; i <= n; i++) out.box(along((i / n) * length, SWITCHBACK.rail / 2 + 0.02), q, 0.13, SWITCHBACK.rail + 0.04, 0.13, PALETTE.trunk, 0.95);
  for (const h of [SWITCHBACK.rail - 0.04, 0.55]) out.box(along(length / 2, h), q, 0.07, 0.07, length, PALETTE.rope);
}
function drawEntry(entry: EntryRamp): Mesh {
  const out = new Boxes(), none = new Quaternion();
  // the road landing: planks across the socket's far edge, two stringers
  const l = entry.landing, along = l.hx >= l.hz, run = 2 * (along ? l.hx : l.hz), across = 2 * (along ? l.hz : l.hx);
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), along ? Math.PI / 2 : 0), n = Math.round(run / PLANK);
  for (let i = 0; i < n; i++) {
    const s = -run / 2 + (i + 0.5) * (run / n), c = new Vector3(l.x + (along ? s : 0), -0.05, l.z + (along ? 0 : s));
    out.box(c, turn, across, 0.1, (run / n) * 0.86, PALETTE.plank, 0.9 + 0.2 * Math.abs(Math.sin(i * 7.31) * 0.5));
  }
  entry.slabs.forEach((slab, i) => { drawSlab(out, slab, i * 31); });
  for (const p of entry.posts) out.box(new Vector3(p.x, (p.from + p.to) / 2, p.z), none, 0.3, p.to - p.from, 0.3, PALETTE.trunk, 0.85);
  // diagonal braces between the tower's posts below the road, the timber trestle under the mockup's switchbacks
  const at = entry.at, brace = (p0: P3, p1: P3): void => {
    const a = new Vector3(p0.x, p0.y, p0.z), b = new Vector3(p1.x, p1.y, p1.z), d = b.clone().sub(a);
    out.box(a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d.clone().normalize()), 0.14, 0.14, d.length(), PALETTE.trunk, 0.8);
  };
  const t = TOWER.t;
  for (let y = -36; y < 0; y += 9) for (const uu of TOWER.u) for (let i = 0; i + 1 < t.length; i++) {
    const t0 = t[i], t1 = t[i + 1]; if (t0 === undefined || t1 === undefined) continue;
    brace(at(t0, uu, y), at(t1, uu, y + 9)); brace(at(t1, uu, y), at(t0, uu, y + 9));
  }
  const mesh = new Mesh(out.geometry(), flat(0xffffff, { vertexColors: true }));
  mesh.name = `far.entry.${entry.edge}`;
  return mesh;
}

/** SF49-g: the four switchback entries (world/ramps.ts) as pieces: each one mesh, its decks, rails and the declared road
 *  landing as colliders. world/build.ts registers them with the bridges, only while the Debug row is on (debug.ts). */
export function entryPieces(): Piece[] {
  return ENTRY_RAMPS.map((entry) => ({ id: `far.entry.${entry.edge}`, name: STRINGS.switchback, category: 'buildings', file: FILE, object: drawEntry(entry), colliders: entryColliders(entry), surface: 'wood' }));
}
