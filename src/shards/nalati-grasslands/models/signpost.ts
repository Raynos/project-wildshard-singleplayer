import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { boardSpots, type BoardSpot } from '../world/painted';
import type { Board, SignpostParams } from '../boot/specimenParams.generated';
import { signpostBaked } from './catalogue';


/**
 * The carved signpost (E306 / E315 second pass; was a block of src/shards/nalati-grasslands/world/RoadFurniture.ts): a larch post with a
 * turned cap and a pointed painted board per destination, each board a plank out from the post in the way it points,
 * lettered on both faces. The valley roads' junctions stand five (the camp turn, the sky road's foot, the gateway, the
 * bowl's crossroads, the E road's turn). The post and boards are painted into the roads' mesh (the post on the timber
 * layer, props.ts GRAIN); the lettering is one small canvas atlas on one extra mesh for all the shard's boards
 * (`letteringMesh`), so a signpost costs no draw of its own. Collides: the post as a box.
 */

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

export const signpost = defineModel<SignpostParams>({
  ...signpostBaked,
  build: (ctx, p, rng) => {
    const built = signpostBaked.build(ctx, p, rng);
    if (!(built instanceof THREE.Object3D)) throw new Error('[nalati roads] baked signpost must return its group');
    built.add(letteringMesh(ctx.sky, [{ spots: boardSpots(0, 0, 0, p.boards), boards: p.boards }]));
    return built;
  },
});
