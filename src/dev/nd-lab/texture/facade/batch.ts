// Copied from the facade lab (src/dev/nd-lab/facade/batch.ts, round-7-lab-facade) into the clean room.
// A Dressing (one tower or a whole street) → draw calls: one merged mesh for the shells / galleries / cables, ONE
// InstancedMesh per kit piece (with the instance tint), ONE InstancedMesh of interior-mapped window quads. A street
// canyon of 8–12 towers is ~25 draws however many towers it has.
import {
  type BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Mesh, PlaneGeometry, type ShaderMaterial,
} from 'three';
import type { Builder } from './geo';
import type { Dressing } from './grammar';
import { jiehuaMaterial, type Uniforms, windowMaterial } from './material';
import { PIECES, type PieceId } from './pieces';

/** pieces small enough to shrink into the wall past the clutter distance */
const SMALL = new Set<PieceId>(['plant', 'planter', 'laundryOut', 'laundryAlong', 'dish', 'acBox']);

const geoCache = new Map<PieceId, { g: BufferGeometry; tris: number }>();
function pieceGeo(id: PieceId): { g: BufferGeometry; tris: number } {
  let e = geoCache.get(id);
  if (e === undefined) {
    const b: Builder = PIECES[id]();
    e = { g: b.build(), tris: b.triangleCount };
    geoCache.set(id, e);
  }
  return e;
}

export interface FacadeStats { draws: number; tris: number; instances: number; windows: number; shellTris: number; perPiece: Record<string, [number, number]> }

export interface FacadeOptions {
  /** [start, end] metres: small clutter shrinks into the wall between them (0 = never) */
  clutterFar?: readonly [number, number];
}

export function buildFacade(d: Dressing, shared: Uniforms, opt: FacadeOptions = {}): { group: Group; stats: FacadeStats } {
  const group = new Group();
  group.name = 'facade';
  const mat = jiehuaMaterial(shared);
  const matSmall = jiehuaMaterial(shared, { shrink: opt.clutterFar ?? [55, 85] });
  const stats: FacadeStats = { draws: 0, tris: 0, instances: 0, windows: d.windows.length, shellTris: d.shell.triangleCount, perPiece: {} };
  // the shell: one merged mesh
  if (d.shell.vertexCount > 0) {
    const shell = new Mesh(d.shell.build(), mat);
    shell.name = 'facade-shell';
    group.add(shell);
    stats.draws++;
    stats.tris += d.shell.triangleCount;
  }
  // the kit: one InstancedMesh per piece
  const byPiece = new Map<PieceId, Dressing['pieces']>();
  for (const p of d.pieces) {
    let l = byPiece.get(p.piece);
    if (l === undefined) { l = []; byPiece.set(p.piece, l); }
    l.push(p);
  }
  for (const [id, list] of byPiece) {
    const { g, tris } = pieceGeo(id);
    const im = new InstancedMesh(g, SMALL.has(id) ? matSmall : mat, list.length);
    im.name = `facade-${id}`;
    list.forEach((p, i) => { im.setMatrixAt(i, p.m); im.setColorAt(i, p.c); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor !== null) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.computeBoundingBox();
    group.add(im);
    stats.draws++;
    stats.instances += list.length;
    stats.tris += tris * list.length;
    stats.perPiece[id] = [list.length, tris * list.length];
  }
  // the windows: one InstancedMesh of unit quads (x ∈ [-0.5, 0.5], y ∈ [0, 1]), interior-mapped
  if (d.windows.length > 0) {
    const q = new PlaneGeometry(1, 1);
    q.translate(0, 0.5, 0);
    const n = d.windows.length;
    const aWin = new Float32Array(n * 4), aWall = new Float32Array(n * 3);
    d.windows.forEach((w, i) => {
      aWin.set([w.win.x, w.win.y, w.win.z, w.win.w], i * 4);
      aWall.set([w.wall.r, w.wall.g, w.wall.b], i * 3);
    });
    q.setAttribute('aWin', new InstancedBufferAttribute(aWin, 4));
    q.setAttribute('aWall', new InstancedBufferAttribute(aWall, 3));
    const wm: ShaderMaterial = windowMaterial(shared);
    const im = new InstancedMesh(q, wm, n);
    im.name = 'facade-windows';
    d.windows.forEach((w, i) => { im.setMatrixAt(i, w.m); im.setColorAt(i, w.light); });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor !== null) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.computeBoundingBox();
    group.add(im);
    stats.draws++;
    stats.tris += 2 * n;
  }
  return { group, stats };
}
