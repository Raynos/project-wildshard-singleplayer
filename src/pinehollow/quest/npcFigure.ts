/**
 * The hamlet's people, stand-ins (PINE-HOLLOW-REMASTER PH-C1 / C6): Hale the ranger, Brandt the miller, Mott the trader
 * as simple standing figures until PH-M4's generated, rigged humans land. ONE factory — `makeNpcFigure(kind, sky)` —
 * is all PH-M4 swaps: the quest only reads the returned handle (`group`, `talkPoint`, `collider`, `update`).
 *
 * Each figure is one merged mesh on a vertex-coloured PBR material shared by all three (+ the ranger's lantern glass on
 * the glow material): 1–2 draws, no lights. The ranger is board B3's "old warden": a long coat, a campaign hat, a grey
 * beard, a brass badge and a lantern held low. They turn to face you when you come near and sway a little as they talk.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Sky } from '../../world/Sky';
import type { Collider } from '../../player/Player';

export type NpcKind = 'ranger' | 'miller' | 'trader';

export interface NpcFigure {
  readonly group: THREE.Group;
  /** where the "[E] Talk" prompt sits (world, the head) */
  readonly talkPoint: THREE.Vector3;
  readonly collider: Collider;
  talking: boolean;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
}

interface Look { coat: string; coatDark: string; shirt: string; legs: string; boots: string; skin: string; hair: string; hat: 'campaign' | 'cap' | 'fur' | 'none'; hatCol: string; beard: 'long' | 'short' | 'none'; apron?: string; lantern: boolean; badge: boolean }
const LOOKS: Record<NpcKind, Look> = {
  ranger: { coat: '#4f4a32', coatDark: '#3a3624', shirt: '#6e5b41', legs: '#3b3a30', boots: '#2a2019', skin: '#b98a6a', hair: '#bdb8ae', hat: 'campaign', hatCol: '#6b5a3c', beard: 'long', lantern: true, badge: true },
  miller: { coat: '#6a4b33', coatDark: '#4d3624', shirt: '#cfc6b0', legs: '#4a4034', boots: '#2d231b', skin: '#c49474', hair: '#8a7b68', hat: 'cap', hatCol: '#5a5146', beard: 'short', apron: '#e2dccb', lantern: false, badge: false },
  trader: { coat: '#5c2a22', coatDark: '#40201b', shirt: '#b7a27f', legs: '#35302a', boots: '#241c16', skin: '#a87a5a', hair: '#2e2620', hat: 'fur', hatCol: '#4a3a2a', beard: 'short', lantern: false, badge: false },
};

let sharedMat: THREE.MeshStandardMaterial | null = null;
let sharedGlow: THREE.MeshBasicMaterial | null = null;
/** the figures' lit material (vertex colours, PBR) — also the ride props' (the zipline trolley, the canoe) */
export function npcMaterial(sky: Sky): THREE.MeshStandardMaterial {
  if (!sharedMat) {
    sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
    sharedMat.name = 'ph-npc';
    sky.setupMaterial(sharedMat);
  }
  return sharedMat;
}
/** unlit glow (lantern glass): the interactables kit's glow program (vertex colours on MeshBasicMaterial) */
export function npcGlowMaterial(): THREE.MeshBasicMaterial {
  sharedGlow ??= new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true });
  return sharedGlow;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

/** a part list builder: every part non-indexed with position + normal + colour */
export class PartKit {
  private parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: string | THREE.Color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): this {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(_m);
    if (geo.hasAttribute('uv')) geo.deleteAttribute('uv');
    if (geo.hasAttribute('uv1')) geo.deleteAttribute('uv1');
    geo.computeVertexNormals();
    const n = geo.getAttribute('position').count, col = new Float32Array(n * 3);
    if (typeof color === 'string') _c.set(color); else _c.copy(color);
    for (let i = 0; i < n; i++) col.set([_c.r, _c.g, _c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(geo);
    return this;
  }
  finish(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

function body(L: Look): THREE.BufferGeometry {
  const k = new PartKit();
  // legs + boots
  for (const s of [-1, 1]) {
    k.add(new THREE.CylinderGeometry(0.075, 0.068, 0.82, 8), L.legs, s * 0.1, 0.45, 0);
    k.add(new THREE.BoxGeometry(0.12, 0.1, 0.24), L.boots, s * 0.1, 0.05, 0.04);
  }
  // the long coat: a flared skirt from the waist to the knees, the torso over it
  k.add(new THREE.CylinderGeometry(0.2, 0.3, 0.72, 12, 1, true), L.coat, 0, 0.66, 0);
  k.add(new THREE.CylinderGeometry(0.195, 0.2, 0.62, 12), L.coat, 0, 1.24, 0, 0, 0, 0, 1, 1, 0.82);
  k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), L.coatDark, 0, 1.0, 0, 0, 0, 0, 1.02, 1, 0.84); // belt
  if (L.apron !== undefined) k.add(new THREE.BoxGeometry(0.32, 0.7, 0.02), L.apron, 0, 0.82, 0.19, -0.06);
  k.add(new THREE.BoxGeometry(0.12, 0.3, 0.02), L.shirt, 0, 1.36, 0.165); // the shirt front at the open collar
  k.add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), L.coat, 0, 1.52, 0, 0, 0, 0, 1.12, 0.45, 0.82); // shoulders
  if (L.badge) k.add(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), '#c9a24a', -0.09, 1.38, 0.17, Math.PI / 2);
  // arms: the left hangs; the right holds the lantern (or hangs too)
  k.add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8), L.coat, -0.25, 1.2, 0, 0, 0, 0.1);
  k.add(new THREE.SphereGeometry(0.05, 8, 6), L.skin, -0.28, 0.87, 0.01);
  if (L.lantern) {
    k.add(new THREE.CylinderGeometry(0.06, 0.05, 0.36, 8), L.coat, 0.25, 1.33, 0.1, -0.9, 0, -0.1);
    k.add(new THREE.CylinderGeometry(0.05, 0.045, 0.32, 8), L.coat, 0.27, 1.1, 0.28, 0.2, 0, 0);
    k.add(new THREE.SphereGeometry(0.05, 8, 6), L.skin, 0.27, 0.95, 0.3);
    // the lantern's iron: a cap, a base, four corner wires, a bail
    k.add(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 8), '#26241f', 0.27, 0.86, 0.3);
    k.add(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 8), '#26241f', 0.27, 0.62, 0.3);
    for (const [dx, dz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) k.add(new THREE.BoxGeometry(0.012, 0.22, 0.012), '#26241f', 0.27 + dx * 0.06, 0.74, 0.3 + dz * 0.06);
  } else {
    k.add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8), L.coat, 0.25, 1.2, 0, 0, 0, -0.1);
    k.add(new THREE.SphereGeometry(0.05, 8, 6), L.skin, 0.28, 0.87, 0.01);
  }
  // head, neck, nose, ears, eyes
  k.add(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8), L.skin, 0, 1.58, 0);
  k.add(new THREE.SphereGeometry(0.105, 14, 10), L.skin, 0, 1.7, 0, 0, 0, 0, 0.92, 1.08, 1);
  k.add(new THREE.ConeGeometry(0.022, 0.06, 6), L.skin, 0, 1.7, 0.105, Math.PI / 2);
  for (const s of [-1, 1]) {
    k.add(new THREE.SphereGeometry(0.025, 6, 4), L.skin, s * 0.098, 1.7, -0.005, 0, 0, 0, 0.5, 1, 1);
    k.add(new THREE.SphereGeometry(0.012, 6, 4), '#15110e', s * 0.037, 1.725, 0.093);
    k.add(new THREE.BoxGeometry(0.045, 0.012, 0.01), L.hair, s * 0.037, 1.752, 0.095, 0, 0, s * 0.12); // brows
  }
  // the beard (the old warden's: long and grey — it also hides the mouth, board B3's reason for him)
  if (L.beard === 'long') k.add(new THREE.ConeGeometry(0.1, 0.24, 10), L.hair, 0, 1.56, 0.07, Math.PI, 0, 0, 1, 1, 0.7);
  if (L.beard !== 'none') k.add(new THREE.SphereGeometry(0.095, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), L.hair, 0, 1.68, 0.02, 0, 0, 0, 1, 0.9, 0.95);
  // hats
  if (L.hat === 'campaign') {
    k.add(new THREE.CylinderGeometry(0.25, 0.26, 0.018, 16), L.hatCol, 0, 1.79, 0);
    k.add(new THREE.CylinderGeometry(0.075, 0.115, 0.15, 4), L.hatCol, 0, 1.87, 0, 0, Math.PI / 4); // the pinched "lemon squeezer" crown
    k.add(new THREE.CylinderGeometry(0.116, 0.118, 0.03, 12), '#3d3222', 0, 1.815, 0); // the band
  } else if (L.hat === 'cap') {
    k.add(new THREE.SphereGeometry(0.115, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), L.hatCol, 0, 1.76, -0.005, 0, 0, 0, 1.05, 0.6, 1.08);
    k.add(new THREE.BoxGeometry(0.16, 0.012, 0.08), L.hatCol, 0, 1.77, 0.12, 0.12);
  } else if (L.hat === 'fur') {
    k.add(new THREE.CylinderGeometry(0.12, 0.115, 0.13, 12), L.hatCol, 0, 1.82, 0);
  } else k.add(new THREE.SphereGeometry(0.108, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), L.hair, 0, 1.72, -0.005);
  return k.finish();
}

function lanternGlass(): THREE.BufferGeometry {
  const k = new PartKit();
  k.add(new THREE.CylinderGeometry(0.055, 0.06, 0.2, 8), new THREE.Color(2.4, 1.35, 0.45), 0.27, 0.74, 0.3);
  return k.finish();
}

/** a stand-in NPC at `feet` facing `yaw` (the quest's one factory: PH-M4 replaces this body, nothing else) */
export function makeNpcFigure(kind: NpcKind, sky: Sky, feet: { x: number; y: number; z: number }, yaw: number): NpcFigure {
  const L = LOOKS[kind];
  const group = new THREE.Group();
  group.name = `npc-${kind}`;
  group.position.set(feet.x, feet.y, feet.z);
  group.rotation.y = yaw;
  const mesh = new THREE.Mesh(body(L), npcMaterial(sky));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  if (L.lantern) group.add(new THREE.Mesh(lanternGlass(), npcGlowMaterial()));
  const collider: Collider = { x: feet.x, z: feet.z, hw: 0.28, hd: 0.28, rot: 0, yTop: feet.y + 1.8, yBottom: feet.y - 0.3 };
  const talkPoint = new THREE.Vector3(feet.x, feet.y + 1.6, feet.z);
  const home = yaw;
  let cur = yaw;
  const fig: NpcFigure = {
    group, talkPoint, collider, talking: false,
    update: (dt, t, player) => {
      const dx = player.x - feet.x, dz = player.z - feet.z, near = dx * dx + dz * dz < 9 * 9;
      const want = near ? Math.atan2(dx, dz) : home;
      let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
      cur += d * Math.min(1, dt * 3);
      group.rotation.y = cur;
      mesh.scale.y = 1 + Math.sin(t * 1.7) * 0.006;
      mesh.rotation.z = fig.talking ? Math.sin(t * 2.3) * 0.025 : 0;
    },
  };
  return fig;
}
