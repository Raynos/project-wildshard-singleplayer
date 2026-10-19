import type { ModelContext, Placement } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
// Copied from the facade lab (the dev labs (deleted in E357 F7), round-7-lab-facade) into the clean room.
// A Dressing → one merged shell mesh (the towers' built fabric, with the few-and-small pieces baked in: models too,
// registered where they are drawn), the kit's pieces placed as models (../../models/facade.ts: one InstancedMesh per
// piece), and instanced window quads.
// E271/E272: facade multi-draw is prohibited on every platform/shard, not just phones.
// See docs/audits/nine-dragon-mobile-multidraw.md before changing this rendering policy.
import { Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PlaneGeometry } from 'three';
import type { Dressing } from './dressing';
import { jiehuaMaterial, type Uniforms, windowMaterial } from '../../look/facadeMaterial';
import type { WorldRows } from '../../runtime/productSections.generated';
import { FACADE_BAKED, FACADE_MODELS } from '../../models/catalogue';
import type { NdLook } from '../modelLook';
import { namePlacedDraws } from '../../runtime/cull/placedDraws';

export interface FacadeStats { draws: number; tris: number; instances: number; windows: number; shellTris: number; perPiece: Record<string, [number, number]> }

export interface FacadeOptions {
  /** [start, end] metres: small clutter shrinks into the wall between them (0 = never) */
  clutterFar?: readonly [number, number];
  /** the build's pause after ~30 ms of placing (the plugin's paced `worldBuildYield`, op-hitch45) */
  pause: () => Promise<void>;
}

/** where the pieces are placed: the fragment's model context and look, and the culler that takes their copies */
export interface FacadeModels {
  readonly ctx: ModelContext;
  readonly look: NdLook;
}

/** the copies of one piece */


/** name a placed model's draws as the old hand-rolled batch was named (the budget ruler's lanes, the GPU ruler's groups and
 *  the E283 culler's LOD names read them); level 0's triangles per copy */
export const nameDraws: typeof namePlacedDraws = namePlacedDraws;

export async function buildFacade(d: Dressing, facade: WorldRows['facade'], records: Float64Array, shared: Uniforms, models: FacadeModels, opt: FacadeOptions): Promise<{ group: Group; stats: FacadeStats }> {
  const group = new Group();
  group.name = 'facade';
  const mat = jiehuaMaterial(shared);
  const matSmall = jiehuaMaterial(shared, { shrink: opt.clutterFar ?? [55, 85] });
  models.look.facade = { mat, small: matSmall };
  const poses = (offset: number, count: number): Placement<Record<string, unknown>>[] => Array.from({ length: count }, (_, index) => {
    const at = offset + index * 19, matrix = new Matrix4().fromArray(records, at);
    return { x: matrix.elements[12], y: matrix.elements[13], z: matrix.elements[14], matrix, color: new Color().fromArray(records, at + 16) };
  });
  const geometry = d.shell, shellTris = (geometry?.index?.count ?? 0) / 3;
  const stats: FacadeStats = { draws: 0, tris: 0, instances: 0, windows: d.windows.length, shellTris, perPiece: {} };
  // the shell: one merged mesh
  if (geometry !== null && geometry.getAttribute('position').count > 0) {
    const shell = new Mesh(geometry, mat);
    shell.name = 'facade-shell';
    group.add(shell);
    stats.draws++;
    stats.tris += shellTris;
    d.shell = null;
    // the pieces baked into it are models drawn there (their copies' boxes: each piece's own bounds at its placement)
    for (const row of facade.baked) {
      const model = FACADE_BAKED[row.id];
      if (model === undefined) throw new Error(`Missing baked facade model ${row.id}`);
      place(model, poses(row.poses, row.count), { ctx: models.ctx, draw: 'merged', drawnInto: { object: shell, boxes: Float32Array.from(records.subarray(row.boxes, row.boxes + row.count * 6)) }, piece: { id: `nds-facade-${row.id}`, name: model.name } });
    }
  }
  // the pieces: one `place` each (a task apart when a piece took long: the phone's ~30 ms tasks)
  let lastYield = performance.now();
  for (const { id, poses: offset, count, small } of facade.drawn) {
    const model = FACADE_MODELS[id];
    if (model === undefined) throw new Error(`facade: no model draws the piece '${id}' (models/facade.ts FACADE_MODELS)`);
    const placements = poses(offset, count);
    const placed = place(model, placements, {
      ctx: models.ctx, draw: 'instanced', cull: { bounds: 'sphere', ...(small ? { far: 85 } : {}) }, parent: group,
      // the small clutter is not drawn past 85 m, where its program has shrunk it into the wall
      piece: { id: `nds-facade-${id}`, name: model.name },
    });
    const tris = nameDraws(placed, `facade-${id}`);
    stats.draws++;
    stats.instances += count;
    stats.tris += tris * count;
    stats.perPiece[id] = [count, tris * count];
    if (performance.now() - lastYield > 30) { await opt.pause(); lastYield = performance.now(); }
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
    const wm = windowMaterial(shared);
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
