/**
 * Pine Hollow's code-built parts, baked offline (SHARD-PLATFORM W2, C1): the session-invariant geometry the page used to
 * build in code, written once into a geometry pack the page reads back exactly (../world/codeParts.ts):
 *   · the hollow log's shell, bore, two rims and rotted bed (../models/hollowLog.ts draws them on the cabins' PBR set);
 *   · the token shelf: the pine rack and the eight carved tokens on edge (../models/tokenShelf.ts);
 *   · the hamlet's three stand-in people and the ranger's lantern glass (./peopleParts.ts rows; ../models/people.ts);
 *   · the zipline trolley and the canoe (../quest/rides.ts);
 *   · the zip-line cable between the gantries' anchors (../models/zipCable.ts);
 *   · the terrain patch over the bear cave's cut, a collider trimesh (../runtime/kit/caveInterior.ts `roofPatch`).
 * Reads only data rows, seeded kits and the terrain lattice its runner passes in; no renderer, page or game service.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { plank } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit } from '@wildshard/engine/world/lowpolyKit';
import { carvedTokenGeometry as carvedToken } from '@wildshard/game/models/pickups';
import HOLLOW_LOG_SHAPE from '../data/hollowLog.json' with { type: 'json' }; // length, outer and bore radius (m), the rotted bed's depth
import { BEAR_CAVE } from '../data/layout';
import authored from '../data/timberWorld.generated.json' with { type: 'json' };
import { buildPrimitiveParts, PartKit } from './primitiveParts';
import { NPC_MILLER_BODY, NPC_RANGER_BODY, NPC_RANGER_GLASS, NPC_TRADER_BODY } from './peopleParts';

const uvScale = (g: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry => {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
};

/** the hollow log in its own space: the axis along local X, the origin on the rotted bed's top (where you stand) */
function hollowLog(): Record<string, THREE.BufferGeometry> {
  const { len, R, r, bed: BED } = HOLLOW_LOG_SHAPE, axis = r - BED;
  const along = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(Math.PI / 2).translate(0, axis, 0); // a Y cylinder → along local X
  const outer = uvScale(along(new THREE.CylinderGeometry(R, R * 1.04, len, 22, 1, true)), 4, 3);
  const inner = uvScale(along(new THREE.CylinderGeometry(r, r, len, 22, 1, true)), 3, 2.5);
  // the bore is seen from inside: flip its winding and its normals
  const idx = inner.index;
  if (idx) for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const nrm = inner.getAttribute('normal');
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  const [rim0, rim1] = [-1, 1].map((s) => new THREE.RingGeometry(r, R, 22, 1).rotateY((s * Math.PI) / 2).translate((s * len) / 2, axis, 0));
  if (rim0 === undefined || rim1 === undefined) throw new Error('hollow log rims');
  const bedW = 2 * Math.sqrt(r * r - (r - BED) ** 2);
  const bedGeo = uvScale(new THREE.BoxGeometry(len - 0.1, 0.1, bedW).translate(0, -r + 0.37 + axis, 0), 5, 1);
  return { 'hollow-log-outer': outer, 'hollow-log-inner': inner, 'hollow-log-rim-0': rim0, 'hollow-log-rim-1': rim1, 'hollow-log-bed': bedGeo };
}

/**
 * The hollow log's collision in its own space (../runtime/models/hollowLog.ts reads these rows): the bed (a flat box you
 * walk on) and a shell of seven boxes round the bore (the bottom eighth is the bed); the mouths are open.
 */
export function hollowLogColliders(): { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; rot?: { x: number; y: number; z: number; w: number }; surface: 'wood' }[] {
  const { len, R, r, bed: BED } = HOLLOW_LOG_SHAPE, axis = r - BED;
  const bedW = 2 * Math.sqrt(r * r - (r - BED) ** 2);
  const out: ReturnType<typeof hollowLogColliders> = [{ kind: 'box', x: 0, y: -0.25, z: 0, hx: len / 2, hy: 0.25, hz: bedW / 2, surface: 'wood' }];
  const T = R - r, midR = (R + r) / 2, N = 8, chord = 2 * midR * Math.tan(Math.PI / N) + 0.05;
  const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;                     // 0 = up, round through the sides (the bore's cross-section)
    if (Math.abs(Math.cos(th) + 1) < 0.2) continue;       // the bottom segment: the bed is there
    q.setFromAxisAngle(X, th);
    out.push({ kind: 'box', x: 0, y: axis + Math.cos(th) * midR, z: Math.sin(th) * midR, hx: len / 2, hy: T / 2, hz: chord / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface: 'wood' });
  }
  return out;
}

const TOKENS = 8, SCALE = 0.6, PITCH = 0.185, LEAN = -0.14;

/** the token shelf in the rack's frame: origin on the mantel top under the rack's centre, +Z out into the room */
function tokenShelf(): THREE.BufferGeometry {
  const k = new LowPolyKit(8088);
  const len = TOKENS * PITCH + 0.12, r = (0.15 * SCALE);
  k.add(plank(len, 0.13, 0.03, k.rng, 0.004).translate(0, 0.015, 0), '#9a7048', { jitter: 0.05 });            // the base
  k.add(plank(len, 0.035, 0.05, k.rng, 0.003).translate(0, 0.055, -0.052), '#6b4a2e', { jitter: 0.04 });      // the back rail
  k.add(plank(len, 0.025, 0.02, k.rng, 0.003).translate(0, 0.04, 0.05), '#6b4a2e', { jitter: 0.04 });        // the front lip
  for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.035, 0.26, 0.13).translate(s * (len / 2 - 0.018), 0.13, 0), '#7c5634', { jitter: 0.05 }); // the end posts
  const parts = [k.finish({ ao: false })];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(SCALE, SCALE, SCALE);
  for (let i = 0; i < TOKENS; i++) {
    // on edge in the slot between the rail and the lip, a hair of lean and turn each so the row reads hand-set
    const x = (i - (TOKENS - 1) / 2) * PITCH;
    e.set(LEAN + ((i * 37) % 5) * 0.012, ((i * 53) % 7 - 3) * 0.03, ((i * 29) % 5 - 2) * 0.02);
    m.compose(p.set(x, 0.03 + r, -0.005), q.setFromEuler(e), sc);
    parts.push(carvedToken(1000 + i).applyMatrix4(m));
  }
  return mergeGeometries(parts, false);
}

/** the zipline trolley: the wheel on the cable, its cheek plate, two hanger rods and the grip bar */
function zipTrolley(): THREE.BufferGeometry {
  const k = new PartKit();
  k.add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), '#3a3d42', 0, 0, 0, 0, 0, Math.PI / 2);
  k.add(new THREE.BoxGeometry(0.07, 0.24, 0.22), '#7a2e22', 0, -0.07, 0);
  for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 5), '#b9a57a', sx * 0.15, -0.46, 0, 0, 0, sx * 0.45);
  k.add(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 6), '#4a3522', 0, -0.76, 0, 0, 0, Math.PI / 2);
  return k.finish();
}

/** the canoe: a lathed birch-bark hull, two thwarts, a paddle across them */
function canoe(): THREE.BufferGeometry {
  const k = new PartKit();
  const hull = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  k.add(hull, '#8a5a34', 0, 0.33, 0, 0, 0, 0, 0.46, 0.34, 2.3);
  k.add(new THREE.TorusGeometry(1, 0.035, 4, 24), '#5b3a22', 0, 0.33, 0, Math.PI / 2, 0, 0, 0.46, 2.3, 1);
  for (const z of [-0.8, 0.8]) k.add(new THREE.BoxGeometry(0.8, 0.04, 0.08), '#6e4a2c', 0, 0.28, z);
  k.add(new THREE.BoxGeometry(0.06, 0.03, 1.5), '#a07a4e', 0.12, 0.33, 0.1, 0, 0.2, 0);
  return k.finish();
}

/** the zip-line cable: a sagging chord (≈ 1.2 % of its span) from its top anchor (the origin) to its bottom one, a thin tube */
function zipCable(): THREE.BufferGeometry {
  const { top, bottom } = authored.landmarks.zip;
  const a = new THREE.Vector3(), b = new THREE.Vector3(...bottom).sub(new THREE.Vector3(...top));
  const sag = a.distanceTo(b) * 0.012;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 5, false);
}

/** the terrain's drawn triangles over the cave's cut (the bake's roof row), heights from the lattice, (x, z) relative to the mouth */
function caveRoof(heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const row = authored.cragAssembly.roof, res = row.resolution, d = row.size / (res - 1), half = row.size / 2, verts: number[] = [];
  for (const ordinal of row.triangles) {
    const cell = Math.floor(ordinal / 2), x0 = (cell % res) * d - half, x1 = x0 + d, z0 = Math.floor(cell / res) * d - half, z1 = z0 + d;
    const corners = ordinal % 2 === 0 ? [[x0, z0], [x0, z1], [x1, z0]] : [[x0, z1], [x1, z1], [x1, z0]];
    for (const [x = 0, z = 0] of corners) verts.push(x - BEAR_CAVE.x, heightAt(x, z), z - BEAR_CAVE.z);
  }
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return g.setIndex(Array.from({ length: verts.length / 3 }, (_, i) => i));
}

/** Ghost Stag's fixed antler tines, in the crossbow root's frame, sharing the finish material at runtime. */
function ghostStagTines(): THREE.BufferGeometry {
  const tipL = new THREE.Vector3(-0.335, 0.004, -0.205), tipR = new THREE.Vector3(0.335, 0.004, -0.205);
  const curve = new THREE.CatmullRomCurve3([tipL, new THREE.Vector3(-0.2, 0.002, -0.275), new THREE.Vector3(0, 0, -0.305), new THREE.Vector3(0.2, 0.002, -0.275), tipR], false, 'catmullrom', 0.5);
  const cone = new THREE.ConeGeometry(1, 1, 7, 1); cone.translate(0, 0.5, 0);
  cone.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cone.getAttribute('position').count * 3).fill(1), 3));
  const tines = [[0.02, 0.085, 0.55, -0.35], [0.1, 0.07, 0.35, -0.2], [0.2, 0.06, 0.15, 0], [0.31, 0.045, 0.05, 0.15]] as const;
  const parts: THREE.BufferGeometry[] = [], up = new THREE.Vector3(0, 1, 0), rotation = new THREE.Quaternion(), euler = new THREE.Euler(), matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  for (const side of [0, 1]) for (const [t0, len, back, out] of tines) {
    const p = curve.getPoint(side ? 1 - t0 : t0);
    position.copy(p).addScaledVector(up, 0.006); scale.set(0.007, len, 0.005);
    rotation.setFromEuler(euler.set(back, 0, side ? -out : out));
    parts.push(cone.clone().applyMatrix4(matrix.compose(position, rotation, scale)));
    if (len > 0.065) {
      position.copy(p).addScaledVector(up, len * 0.45); scale.set(0.005, len * 0.45, 0.004);
      rotation.setFromEuler(euler.set(back + 0.9, 0, side ? -(out + 0.5) : out + 0.5));
      parts.push(cone.clone().applyMatrix4(matrix.compose(position, rotation, scale)));
    }
  }
  const geometry = mergeGeometries(parts, false); cone.dispose(); for (const part of parts) part.dispose();
  return geometry;
}

/** every code-built part, by name, in pack order */
export function pineCodeParts(heightAt: (x: number, z: number) => number): Record<string, THREE.BufferGeometry> {
  return {
    ...hollowLog(),
    'token-shelf': tokenShelf(),
    'npc-ranger': buildPrimitiveParts(NPC_RANGER_BODY), 'npc-ranger-glass': buildPrimitiveParts(NPC_RANGER_GLASS),
    'npc-miller': buildPrimitiveParts(NPC_MILLER_BODY), 'npc-trader': buildPrimitiveParts(NPC_TRADER_BODY),
    'zip-trolley': zipTrolley(), canoe: canoe(), 'zip-cable': zipCable(), 'cave-roof': caveRoof(heightAt), 'ghost-stag-tines': ghostStagTines(),
  };
}

/** The pack: its bytes, its rows and each part's geometry index. */
export function bakePineCodeParts(heightAt: (x: number, z: number) => number): { bin: Uint8Array; rows: PackedGeometryRows; parts: Record<string, number> } {
  const writer = new GeometryPackWriter('pine code parts'), parts: Record<string, number> = {};
  for (const [name, geometry] of Object.entries(pineCodeParts(heightAt))) { parts[name] = writer.add(geometry); geometry.dispose(); }
  return { bin: writer.bytes(), rows: writer.rows(), parts };
}
