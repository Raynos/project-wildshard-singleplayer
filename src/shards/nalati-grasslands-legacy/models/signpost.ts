/**
 * The carved signpost (E306 / E315 second pass; was a block of src/shards/nalati-grasslands/world/RoadFurniture.ts): a larch post with a
 * turned cap and a pointed painted board per destination, each board a plank out from the post in the way it points,
 * lettered on both faces. The valley roads' junctions stand five (the camp turn, the sky road's foot, the gateway, the
 * bowl's crossroads, the E road's turn). The post and boards are painted into the roads' mesh (the post on the timber
 * layer, props.ts GRAIN); the lettering is one small canvas atlas on one extra mesh for all the shard's boards
 * (`letteringMesh`), so a signpost costs no draw of its own. Collides: the post as a box.
 */
import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelBuild, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { M, v3, woodPole } from '../world/paint';
import { PC, GRAIN, WOOD } from '../world/props';
import { painted, type Paint } from '../world/painted';

export interface Board {
  readonly text: string;
  /** the way the arrow points (world yaw of the direction, atan2(dx, dz)) */
  readonly dir: number;
}

export interface SignpostParams { readonly boards: readonly Board[] }

/** one board's plank: its centre, its yaw (local +x = the pointing way), its width */
export interface BoardSpot { readonly p: THREE.Vector3; readonly yaw: number; readonly w: number }

/** where a signpost at (x, gy, z) hangs its boards, top down */
export function boardSpots(x: number, z: number, gy: number, boards: readonly Board[]): BoardSpot[] {
  const H = 1.9 + boards.length * 0.36;
  return boards.map((b, i) => {
    const y = gy + H - 0.3 - i * 0.36, w = 1.45;
    const yaw = b.dir - Math.PI / 2;                                       // M's local +x → world (sin dir, cos dir)
    const cx = x + Math.sin(b.dir) * (w / 2 + 0.05), cz = z + Math.cos(b.dir) * (w / 2 + 0.05);
    return { p: v3(cx, y, cz), yaw, w };
  });
}

const paint: Paint<SignpostParams> = (kit, at, p, c) => {
  const s = { x: at.x, z: at.z };
  const gy = c.ground(s.x, s.z), H = 1.9 + p.boards.length * 0.36;
  kit.add(woodPole(v3(s.x, gy - 0.4, s.z), v3(s.x, gy + H, s.z), 0.09, 0.075, 8, 3), GRAIN, { ...WOOD, foot: 0.7, brush: 0.14 });
  kit.add(new THREE.ConeGeometry(0.11, 0.2, 8).translate(s.x, gy + H + 0.1, s.z), PC.woodDark);
  for (const b of boardSpots(s.x, s.z, gy, p.boards)) {
    const m = M(b.p.x, b.p.y, b.p.z, b.yaw);
    kit.add(new THREE.BoxGeometry(b.w, 0.27, 0.045), PC.woodDark, { matrix: m, flat: true });
    const tip = new THREE.CylinderGeometry(0.19, 0.19, 0.045, 3).rotateX(Math.PI / 2).scale(0.75, 1, 1).translate(b.w / 2 + 0.06, 0, 0);
    kit.add(tip, PC.woodDark, { matrix: m, flat: true });
  }
  return { boxes: [{ x: s.x, z: s.z, hw: 0.14, hd: 0.14, rot: 0, yBottom: gy - 1, yTop: gy + H }] };
};

const LABEL_H = 64, ATLAS_W = 512;

function makeAtlas(labels: readonly string[]): THREE.CanvasTexture {
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

/** the boards of the signposts a lettering mesh letters: each signpost's spots and boards, in order */
type Lettered = readonly { readonly spots: readonly BoardSpot[]; readonly boards: readonly Board[] }[];

/**
 * The lettering of every board in `posts` (each signpost's boards, in order): quads on both faces of every board, uv
 * into one atlas of their labels (the back face mirrors so it reads right), on one painterly material with a map.
 */
export function letteringMesh(sky: Sky, posts: Lettered): THREE.Mesh {
  const { geometry, material } = lettering(sky, posts);
  const text = new THREE.Mesh(geometry, material);
  text.name = 'nalati-signs';
  text.receiveShadow = true;
  return text;
}

function lettering(sky: Sky, posts: Lettered): { geometry: THREE.BufferGeometry; material: THREE.MeshLambertMaterial } {
  const labels: string[] = [];
  const quads: { p: THREE.Vector3; yaw: number; w: number; row: number; flip: boolean }[] = [];
  for (const s of posts) s.spots.forEach((b, i) => {
    labels.push(s.boards[i]?.text ?? '');
    const row = labels.length - 1;
    quads.push({ p: b.p, yaw: b.yaw, w: b.w, row, flip: false }, { p: b.p, yaw: b.yaw, w: b.w, row, flip: true });
  });
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
  const material = painterlyMaterial(sky, { rim: 0.2 });
  material.map = atlas;
  return { geometry: g, material };
}

const specimen = painted(paint, { seed: 0x5197, layers: ['rock'] });

export const signpost = defineModel<SignpostParams>({
  id: 'nalati-grasslands/signpost', name: 'Carved signpost', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/signpost.ts', surface: 'wood',
  defaults: { boards: [{ text: 'NOMAD CAMP', dir: Math.PI / 2 }, { text: 'SKY GRASSLAND', dir: Math.PI }, { text: 'KUNES BRIDGE', dir: 0 }] },
  // the painted post and boards (NalatiSet paints them into the roads' mesh), and for the Explorer's specimen its own
  // boards' lettering too (in the world, the roads letter every board on one mesh)
  build: Object.assign((ctx: ModelContext, p: SignpostParams, rng: Rng): ModelBuild => {
    const built = specimen(ctx, p, rng);
    if (!Array.isArray(built)) return built;
    const text = lettering(ctx.sky, [{ spots: boardSpots(0, 0, 0, p.boards), boards: p.boards }]);
    const parts: ModelPart[] = [...(built as readonly ModelPart[]), { geometry: text.geometry, material: text.material, receiveShadow: true }];
    return parts;
  }, { paint: specimen.paint, spec: specimen.spec }),
});
