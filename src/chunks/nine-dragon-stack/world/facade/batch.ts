// Copied from the facade lab (src/dev/nd-lab/facade/batch.ts, round-7-lab-facade) into the clean room.
// A Dressing → one merged shell mesh, one InstancedMesh per kit piece, and instanced window quads.
// E271/E272: facade multi-draw is prohibited on every platform/shard, not just phones.
// See docs/audits/nine-dragon-mobile-multidraw.md before changing this rendering policy.
import {
  type BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PlaneGeometry, type ShaderMaterial,
} from 'three';
import type { Builder } from './geo';
import type { Dressing } from './grammar';
import { jiehuaMaterial, type Uniforms, windowMaterial } from '../../look/facadeMaterial';
import { CAGE_W, CAGE_W0, PAL, PIECES, PIECE_LODS, type PieceId } from './pieces';
import type { InstanceLevel } from '../cull';

/** pieces small enough to shrink into the wall past the clutter distance */
const SMALL = new Set<PieceId>(['plant', 'planter', 'laundryOut', 'laundryAlong', 'dish']);

/**
 * The facade lane's draw diet (E281: ~28 draws against a cap of 20; multi-draw is prohibited, E271 / E272).
 * DRAWN_AS: ids that share another piece's geometry — the placement is composed with `local` and its colour
 * multiplied by `tint` (the ledges, bay boxes and gallery posts are one unit box; the two cages one cage; the two
 * rooftop shacks one shack whose roof takes the tint). BAKED: the few-and-small pieces (red couplets, shutters, sign
 * boards and boxes, window ACs, the wash on street lines, awnings) are merged into the shell, which is drawn anyway.
 */
const S = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeScale(x, y, z);
const DRAWN_AS: Partial<Record<PieceId, { as: PieceId; local: Matrix4; tint: number }>> = {
  ledge: { as: 'box', local: S(1, 0.1, 0.36), tint: PAL.slab },
  bayBox: { as: 'box', local: S(1, 1, 0.6), tint: 0xffffff },
  post: { as: 'box', local: new Matrix4().makeTranslation(0, 0, -0.11).multiply(S(0.22, 1, 0.22)), tint: 0xb8321f },
  cageS: { as: 'cage', local: S(CAGE_W[0] / CAGE_W0, 1, 1), tint: 0xffffff },
  cageW: { as: 'cage', local: S(CAGE_W[1] / CAGE_W0, 1, 1), tint: 0xffffff },
  shackG: { as: 'shack', local: new Matrix4(), tint: PAL.malachite },
  shackB: { as: 'shack', local: new Matrix4(), tint: PAL.azurite },
};
const BAKED = new Set<PieceId>(['couplet', 'shutter', 'signFlat', 'signBox', 'acBox', 'washLine', 'awning']);
const bakeCache = new Map<PieceId, Builder>();

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

export function buildFacade(d: Dressing, shared: Uniforms, opt: FacadeOptions = {}): { group: Group; stats: FacadeStats; small: InstancedMesh[]; lods: Map<InstancedMesh, InstanceLevel[]> } {
  const group = new Group();
  // the SMALL pieces' batches (the engine's culler drops their instances past the clutter distance)
  const small: InstancedMesh[] = [];
  // (E283) the pieces' distance LODs (pieces.ts PIECE_LODS), for the culler
  const lods = new Map<InstancedMesh, InstanceLevel[]>();
  group.name = 'facade';
  const mat = jiehuaMaterial(shared);
  const matSmall = jiehuaMaterial(shared, { shrink: opt.clutterFar ?? [55, 85] });
  // the kit: one instanced draw per drawn geometry; the baked pieces go into the shell first
  const byPiece = new Map<PieceId, Dressing['pieces']>();
  const tc = new Color();
  for (const p of d.pieces) {
    if (BAKED.has(p.piece)) {
      let b = bakeCache.get(p.piece);
      if (b === undefined) { b = PIECES[p.piece](); bakeCache.set(p.piece, b); }
      d.shell.append(b, p.m, p.c);
      continue;
    }
    const alias = DRAWN_AS[p.piece];
    const id = alias?.as ?? p.piece;
    const q = alias === undefined ? p : { piece: id, m: p.m.clone().multiply(alias.local), c: p.c.clone().multiply(tc.setHex(alias.tint)) };
    let l = byPiece.get(id);
    if (l === undefined) { l = []; byPiece.set(id, l); }
    l.push(q);
  }
  const stats: FacadeStats = { draws: 0, tris: 0, instances: 0, windows: d.windows.length, shellTris: d.shell.triangleCount, perPiece: {} };
  // the shell: one merged mesh
  if (d.shell.vertexCount > 0) {
    const shell = new Mesh(d.shell.build(), mat);
    shell.name = 'facade-shell';
    group.add(shell);
    stats.draws++;
    stats.tris += d.shell.triangleCount;
    d.shell.release();
  }
  for (const [id, list] of byPiece) {
    const { g, tris } = pieceGeo(id);
    const im = new InstancedMesh(g, SMALL.has(id) ? matSmall : mat, list.length);
    im.name = `facade-${id}`;
    if (SMALL.has(id)) small.push(im);
    const lod = PIECE_LODS[id];
    if (lod !== undefined) lods.set(im, [{ geometry: lod.far().build(), from: lod.from }]);
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
  return { group, stats, small, lods };
}
