import * as THREE from 'three';
import type { Board } from './campParams';
import type { BoardSpot } from './painted';

export function paintSignAtlas(c: HTMLCanvasElement, labels: readonly string[]): void {
  const LABEL_H = 64, ATLAS_W = 512;
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
}

export type Lettered = readonly { readonly spots: readonly BoardSpot[]; readonly boards: readonly Board[] }[];

export function letteringGeometry(posts: Lettered): THREE.BufferGeometry {
  const labels: string[] = [];
  const quads: { p: THREE.Vector3; yaw: number; w: number; row: number; flip: boolean }[] = [];
  for (const s of posts) s.spots.forEach((b, i) => {
    labels.push(s.boards[i]?.text ?? '');
    const row = labels.length - 1;
    quads.push({ p: b.p, yaw: b.yaw, w: b.w, row, flip: false }, { p: b.p, yaw: b.yaw, w: b.w, row, flip: true });
  });
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
  return g;
}
