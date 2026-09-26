// Copied from the facade lab (src/dev/nd-lab/facade/batch.ts, round-7-lab-facade) into the clean room.
// A Dressing (one tower or a whole street) → draw calls: one merged mesh for the shells / galleries / cables, ONE
// InstancedMesh per small piece (for the distance shrink), one BatchedMesh for the rest when WEBGL_multi_draw is
// available, and one InstancedMesh of interior-mapped window quads. The fallback retains the original instancing.
import {
  BatchedMesh, type BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Mesh, PlaneGeometry, type ShaderMaterial,
} from 'three';
import type { Builder } from './geo';
import type { Dressing } from './grammar';
import { jiehuaMaterial, type Uniforms, windowMaterial } from '../../look/facadeMaterial';
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
  /** Pass the live renderer's WEBGL_multi_draw support. Without it, BatchedMesh costs one call per instance. */
  multiDraw?: boolean;
}

export function buildFacade(d: Dressing, shared: Uniforms, opt: FacadeOptions = {}): { group: Group; stats: FacadeStats; small: InstancedMesh[] } {
  const group = new Group();
  // the SMALL pieces' batches (the engine's culler drops their instances past the clutter distance)
  const small: InstancedMesh[] = [];
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
  // the kit: one multi-draw batch for large pieces, while distance-shrunk clutter stays instanced
  const byPiece = new Map<PieceId, Dressing['pieces']>();
  for (const p of d.pieces) {
    let l = byPiece.get(p.piece);
    if (l === undefined) { l = []; byPiece.set(p.piece, l); }
    l.push(p);
  }
  const batchedPieces = opt.multiDraw
    ? [...byPiece].filter(([id]) => !SMALL.has(id))
    : [];
  const batchInstances = batchedPieces.reduce((sum, [, list]) => sum + list.length, 0);
  const batchVertices = batchedPieces.reduce((sum, [id]) => sum + pieceGeo(id).g.getAttribute('position').count, 0);
  const batchIndices = batchedPieces.reduce((sum, [id]) => sum + (pieceGeo(id).g.getIndex()?.count ?? 0), 0);
  if (batchInstances > 0) {
    const batch = new BatchedMesh(batchInstances, batchVertices, batchIndices, mat);
    batch.name = 'facade-large-batch';
    // Opaque geometry already has a fixed order. Keep per-instance frustum culling without sorting every frame.
    batch.sortObjects = false;
    for (const [id, list] of batchedPieces) {
      const { g } = pieceGeo(id);
      const geometryId = batch.addGeometry(g);
      for (const p of list) {
        const instanceId = batch.addInstance(geometryId);
        batch.setMatrixAt(instanceId, p.m);
        batch.setColorAt(instanceId, p.c);
      }
    }
    batch.computeBoundingSphere();
    group.add(batch);
    stats.draws++;
  }
  for (const [id, list] of byPiece) {
    const { g, tris } = pieceGeo(id);
    if (opt.multiDraw && !SMALL.has(id)) {
      stats.instances += list.length;
      stats.tris += tris * list.length;
      stats.perPiece[id] = [list.length, tris * list.length];
      continue;
    }
    const im = new InstancedMesh(g, SMALL.has(id) ? matSmall : mat, list.length);
    im.name = `facade-${id}`;
    if (SMALL.has(id)) small.push(im);
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
  return { group, stats, small };
}
