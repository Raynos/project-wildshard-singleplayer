/**
 * RoadFurniture — split-rail fences along the valley roads (the N road from the gate to the bridge, the camp spur,
 * keeping the sheep pasture off the road) and carved signposts at the junctions (the camp turn, the foot of the sky
 * road, the rim where the sky road tops out, the kurgan turn on the E road). The posts and boards are in the merged
 * POI mesh; the lettering is one small canvas atlas on one extra mesh (a painterly material with a map).
 *
 *   const roads = buildRoadFurniture(ctx);   // PoiPiece (object = a group of the two meshes)
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3 } from './paint';
import { addFence, PC } from './props';
import { painterlyMaterial } from '../painterly';
import { CAMP } from './layout';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';

interface Board { text: string; /** the way the arrow points (world yaw of the direction, atan2(dx, dz)) */ dir: number }
interface Signpost { x: number; z: number; boards: Board[] }

const dirTo = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(x1 - x0, z1 - z0);
/** compass directions as `dir` yaws: +z north, +x west */
const N = 0, S = Math.PI, W = Math.PI / 2, E = -Math.PI / 2;

const SIGNS: Signpost[] = [
  { x: -5.2, z: 191, boards: [{ text: 'NOMAD CAMP', dir: dirTo(0, 196, CAMP.x, CAMP.z) }, { text: 'SKY GRASSLAND', dir: S }, { text: 'SHEEP PASTURE', dir: E + 0.15 }] },
  { x: 6.5, z: 131, boards: [{ text: 'SKY ROAD', dir: S + 0.3 }, { text: 'KUNES BRIDGE', dir: N }] },
  { x: 26, z: -30, boards: [{ text: 'EAGLE ROCK', dir: W }, { text: 'KURGAN FIELD', dir: E - 0.3 }, { text: 'BALBAL CIRCLE', dir: S }, { text: 'VALLEY · CAMP', dir: N }] },
  { x: -168, z: -40, boards: [{ text: 'KURGAN FIELD', dir: dirTo(-168, -40, -118, -82) }, { text: 'E ROAD', dir: dirTo(-168, -40, -250, 0) }] },
];

const LABEL_H = 64, ATLAS_W = 512;

function makeAtlas(labels: string[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = ATLAS_W; c.height = LABEL_H * Math.max(1, labels.length);
  const g = c.getContext('2d');
  if (!g) throw new Error('[nalati roads] no 2d canvas context');
  labels.forEach((t, i) => {
    const y = i * LABEL_H;
    // weathered painted board
    g.fillStyle = '#9c7446'; g.fillRect(0, y, ATLAS_W, LABEL_H);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(60,38,20,${0.05 + (k % 3) * 0.03})`; g.fillRect(0, y + 4 + k * 4.3, ATLAS_W, 1.5); }
    g.strokeStyle = '#5b3c22'; g.lineWidth = 5; g.strokeRect(4, y + 4, ATLAS_W - 8, LABEL_H - 8);
    g.fillStyle = '#f3e7cc';
    g.font = 'bold 34px Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, ATLAS_W / 2 - 14, y + LABEL_H / 2 + 2, ATLAS_W - 90);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildRoadFurniture(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0x70ad);
  const colliders: Collider[] = [];

  // ── fences ──
  // N road, both sides, gate to the bridge; the west side opens for the camp spur
  addFence(kit, ground, [[5.8, 244], [5.6, 214], [6.0, 202]], colliders);
  addFence(kit, ground, [[5.4, 189], [5.8, 183]], colliders);
  addFence(kit, ground, [[-5.8, 244], [-5.6, 220], [-5.9, 198], [-5.5, 182]], colliders);
  // the camp spur's south side, and a paddock fence off the pasture
  addFence(kit, ground, [[9, 191], [26, 194], [42, 196.5], [60, 199]], colliders);
  addFence(kit, ground, [[-12, 238], [-40, 236], [-70, 231], [-96, 228]], colliders, { h: 1.0, spacing: 2.8 });

  // ── signposts ──
  const labels: string[] = [];
  const quads: { p: THREE.Vector3; yaw: number; w: number; row: number; flip: boolean }[] = [];
  for (const s of SIGNS) {
    const gy = ground(s.x, s.z), H = 1.9 + s.boards.length * 0.36;
    kit.add(pole(v3(s.x, gy - 0.4, s.z), v3(s.x, gy + H, s.z), 0.09, 0.075, 8), PC.woodGrey, { foot: 0.7 });
    kit.add(new THREE.ConeGeometry(0.11, 0.2, 8).translate(s.x, gy + H + 0.1, s.z), PC.woodDark);
    colliders.push({ x: s.x, z: s.z, hw: 0.14, hd: 0.14, rot: 0, yBottom: gy - 1, yTop: gy + H });
    s.boards.forEach((b, i) => {
      const y = gy + H - 0.3 - i * 0.36, w = 1.45;
      // a board is a plank out from the post in its direction, with a pointed tip; local +x = the pointing way
      const yaw = b.dir - Math.PI / 2;                                       // M's local +x → world (sin dir, cos dir)
      const cx = s.x + Math.sin(b.dir) * (w / 2 + 0.05), cz = s.z + Math.cos(b.dir) * (w / 2 + 0.05);
      const m = M(cx, y, cz, yaw);
      kit.add(new THREE.BoxGeometry(w, 0.27, 0.045), PC.woodDark, { matrix: m, flat: true });
      const tip = new THREE.CylinderGeometry(0.19, 0.19, 0.045, 3).rotateX(Math.PI / 2).scale(0.75, 1, 1).translate(w / 2 + 0.06, 0, 0);
      kit.add(tip, PC.woodDark, { matrix: m, flat: true });
      labels.push(b.text);
      const row = labels.length - 1;
      quads.push({ p: v3(cx, y, cz), yaw, w, row, flip: false }, { p: v3(cx, y, cz), yaw, w, row, flip: true });
    });
  }
  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-roads';

  // lettering: quads on both faces of every board, uv into the atlas (the back face mirrors so it reads right)
  const atlas = makeAtlas(labels);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const rows = labels.length, tmp = new THREE.Vector3(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const d of quads) {
    q.setFromAxisAngle(up, d.yaw);
    const zf = d.flip ? -0.0235 : 0.0235, hw = d.w / 2 - 0.02, hh = 0.125;
    const base = pos.length / 3;
    const v0 = 1 - (d.row + 1) / rows, v1 = 1 - d.row / rows;
    const corners: [number, number, number, number][] = [[-hw, -hh, 0, v0], [hw, -hh, 1, v0], [hw, hh, 1, v1], [-hw, hh, 0, v1]];
    for (const [lx, ly, u, v] of corners) {
      tmp.set(lx, ly, zf).applyQuaternion(q).add(d.p);
      pos.push(tmp.x, tmp.y, tmp.z);
      tmp.set(0, 0, d.flip ? -1 : 1).applyQuaternion(q);
      nrm.push(tmp.x, tmp.y, tmp.z);
      uv.push(d.flip ? 1 - u : u, v);
      col.push(1, 1, 1);
    }
    if (d.flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = painterlyMaterial(sky, { rim: 0.2 });
  mat.map = atlas;
  const text = new THREE.Mesh(g, mat);
  text.name = 'nalati-signs';
  text.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh, text);
  return { name: 'roads', object: group, colliders, platforms: [], tris: mesh.geometry.getAttribute('position').count / 3 + idx.length / 3 };
}
