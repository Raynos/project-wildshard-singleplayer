import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,Group,Mesh,type Material} from 'three';
import type {NpcRow} from '@wildshard/game/plugin/quests';
import {fitGeometry} from '@wildshard/game/plugin/geometry';

// Frozen pre-optimization geometry law; exact bytes, pivots and bounds are the oracle.
function partition(source: BufferGeometry, parts: number, of: (x: number, y: number, z: number) => number, flat: boolean): BufferGeometry[] {
  const g = source.index === null ? source : source.toNonIndexed(), p = g.getAttribute('position'), side: number[] = [];
  for (let t = 0; t + 2 < p.count; t += 3) side.push(of((p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3));
  const out = Array.from({ length: parts }, (_, part) => {
    const r = new BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes)) {
      const values: number[] = [];
      side.forEach((s, t) => { if (s === part) for (let v = t * 3; v < t * 3 + 3; v++) for (let c = 0; c < a.itemSize; c++) values.push(a.getComponent(v, c)); });
      r.setAttribute(name, new Float32BufferAttribute(values, a.itemSize));
    }
    if (flat) r.computeVertexNormals();
    r.computeBoundingBox(); r.computeBoundingSphere(); return r;
  });
  if (g !== source) g.dispose();
  source.dispose(); return out;
}

export function releasedPivotNpcParts(row: NpcRow, source: BufferGeometry, material?: Material): { root: Group; head: Group; arm: Group; elbow: Group } {
  const fig = row.figure, neck = fig.neck, [sx, sy, sz] = fig.shoulder, top = fig.armTopY ?? (neck === undefined ? Infinity : neck[1] + 0.02);
  const slope = fig.armSlope ?? 0, cut = fig.elbow, [ex, ey, ez] = cut?.at ?? fig.shoulder;
  const whole = fitGeometry(source, { size: fig.height, by: 'height', ...(fig.centre === undefined ? {} : { centre: fig.centre }) });
  const [body, head, arm, fore] = partition(whole, 4, (x, y) => neck !== undefined && y >= neck[1] ? 1
    : x < fig.armBelowX + slope * y && y > fig.armAboveY && y < top ? (cut !== undefined && (x - ex) * cut.axis[0] + (y - ey) * cut.axis[1] > 0 ? 3 : 2) : 0, fig.flat);
  const paint = material ?? new MeshStandardMaterial({ vertexColors: true, roughness: fig.roughness, metalness: 0, flatShading: fig.flat });
  const root = new Group(), headPivot = new Group(), armPivot = new Group(), elbow = new Group();
  if (neck !== undefined) { headPivot.position.set(neck[0], neck[1], neck[2]); head?.translate(-neck[0], -neck[1], -neck[2]); }
  armPivot.position.set(sx, sy, sz); elbow.position.set(ex - sx, ey - sy, ez - sz);
  for (const [g, pivot] of [[body, root], [head, headPivot], [arm?.translate(-sx, -sy, -sz), armPivot], [fore?.translate(-ex, -ey, -ez), elbow]] as const) {
    if (g === undefined) continue;
    if (g.getAttribute('position').count > 0) pivot.add(new Mesh(g, paint)); else g.dispose();
  }
  armPivot.add(elbow); root.add(headPivot, armPivot);
  return { root, head: headPivot, arm: armPivot, elbow };
}

