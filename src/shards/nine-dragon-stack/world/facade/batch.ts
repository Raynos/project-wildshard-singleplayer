import { resourceScope } from '@wildshard/engine/app/resources';
import type { ModelContext, Placement } from '@wildshard/engine/models/model';
import { type InstancedCuller, type Placed, place } from '@wildshard/engine/models/place';
// Copied from the facade lab (the dev labs (deleted in E357 F7), round-7-lab-facade) into the clean room.
// A Dressing → one merged shell mesh (the towers' built fabric, with the few-and-small pieces baked in: models too,
// registered where they are drawn), the kit's pieces placed as models (../../models/facade.ts: one InstancedMesh per
// piece), and instanced window quads.
// E271/E272: facade multi-draw is prohibited on every platform/shard, not just phones.
// See docs/audits/nine-dragon-mobile-multidraw.md before changing this rendering policy.
import { Box3, Color, Group, InstancedBufferAttribute, InstancedMesh, type Matrix4, Mesh, type Object3D, PlaneGeometry, type ShaderMaterial } from 'three';
import type { Dressing } from './dressing';
import { jiehuaMaterial, type Uniforms, windowMaterial } from '../../look/facadeMaterial';
import { BAKED, DRAWN_AS, SMALL, type PieceId } from './pieceIds';
import { FACADE_BAKED, FACADE_MODELS, type FacadeParams } from '../../models/facade';
import type { NdLook } from '../modelLook';
import { triCount } from '@wildshard/sdk/cull/meshLod';

export interface FacadeStats { draws: number; tris: number; instances: number; windows: number; shellTris: number; perPiece: Record<string, [number, number]> }

export interface FacadeOptions {
  /** [start, end] metres: small clutter shrinks into the wall between them (0 = never) */
  clutterFar?: readonly [number, number];
}

/** where the pieces are placed: the fragment's model context and look, and the culler that takes their copies */
export interface FacadeModels {
  readonly ctx: ModelContext;
  readonly look: NdLook;
  readonly culler: InstancedCuller;
}

/** the copies of one piece */
interface Copy { m: Matrix4; c: Color }

/**
 * Name a placed model's draws as the old hand-rolled batch was named (the budget ruler's lanes, the GPU ruler's groups
 * and the E283 culler's LOD names read them): the object and its level-0 mesh; returns level 0's triangles per copy.
 */
export function nameDraws(placed: Placed, name: string): number {
  placed.object.name = name;
  const isBatch = (o: Object3D): o is InstancedMesh => o instanceof InstancedMesh;
  const base = isBatch(placed.object) ? placed.object : placed.object.children.find(isBatch);
  if (base === undefined) return 0;
  base.name = name;
  return triCount(base.geometry);
}

export async function buildFacade(d: Dressing, shared: Uniforms, models: FacadeModels, opt: FacadeOptions = {}): Promise<{ group: Group; stats: FacadeStats }> {
  const group = new Group();
  group.name = 'facade';
  const mat = jiehuaMaterial(shared);
  const matSmall = jiehuaMaterial(shared, { shrink: opt.clutterFar ?? [55, 85] });
  models.look.facade = { mat, small: matSmall };
  // the kit: one instanced draw per drawn geometry; the baked pieces go into the shell first
  const byPiece = new Map<PieceId, Copy[]>();
  /** the copies of the pieces merged into the shell, per piece (G285: the layout bake merged them,
   *  ../../generators/facadePieces.ts `mergeBakedPieces`; models/facade.ts FACADE_BAKED: registered on the shell below) */
  const baked = new Map<PieceId, Copy[]>();
  const tc = new Color();
  for (const p of d.pieces) {
    if (BAKED.has(p.piece)) {
      let l = baked.get(p.piece);
      if (l === undefined) { l = []; baked.set(p.piece, l); }
      l.push(p);
      continue;
    }
    const alias = DRAWN_AS[p.piece];
    const id = alias?.as ?? p.piece;
    const q: Copy = alias === undefined ? p : { m: p.m.clone().multiply(alias.local), c: p.c.clone().multiply(tc.setHex(alias.tint)) };
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
    // the pieces baked into it are models drawn there (their copies' boxes: each piece's own bounds at its placement)
    const box = new Box3();
    for (const [id, list] of baked) {
      const model = FACADE_BAKED[id], own = d.merged.get(id);
      if (model === undefined || own === undefined) throw new Error(`facade: no model is the baked piece '${id}' (models/facade.ts FACADE_BAKED)`);
      const boxes = new Float32Array(list.length * 6);
      const placements: Placement<FacadeParams>[] = list.map((p, i) => {
        box.copy(own).applyMatrix4(p.m);
        boxes.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z], i * 6);
        return { x: p.m.elements[12], y: p.m.elements[13], z: p.m.elements[14], matrix: p.m, color: p.c };
      });
      place(model, placements, { ctx: models.ctx, draw: 'merged', drawnInto: { object: shell, boxes }, piece: { id: `nds-facade-${id}`, name: model.name } });
    }
  }
  // the pieces: one `place` each (a task apart when a piece took long: the phone's ~30 ms tasks)
  let lastYield = performance.now();
  for (const [id, list] of byPiece) {
    const model = FACADE_MODELS[id];
    if (model === undefined) throw new Error(`facade: no model draws the piece '${id}' (models/facade.ts FACADE_MODELS)`);
    const placements: Placement<FacadeParams>[] = list.map((p) => ({ x: p.m.elements[12], y: p.m.elements[13], z: p.m.elements[14], matrix: p.m, color: p.c }));
    const placed = place(model, placements, {
      ctx: models.ctx, draw: 'instanced', culler: models.culler, parent: group,
      // the small clutter is not drawn past 85 m, where its program has shrunk it into the wall
      ...(SMALL.has(id) ? { cull: { far: 85 } } : {}),
      piece: { id: `nds-facade-${id}`, name: model.name },
    });
    const tris = nameDraws(placed, `facade-${id}`);
    stats.draws++;
    stats.instances += list.length;
    stats.tris += tris * list.length;
    stats.perPiece[id] = [list.length, tris * list.length];
    if (performance.now() - lastYield > 30) { await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); }); lastYield = performance.now(); }
  }
  // the windows: one InstancedMesh of unit quads (x ∈ [-0.5, 0.5], y ∈ [0, 1]), interior-mapped — the towers' own
  // windows, part of their fabric (world)
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
