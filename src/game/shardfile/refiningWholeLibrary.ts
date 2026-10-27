import { type BufferAttribute, BufferGeometry, InterleavedBufferAttribute, Matrix4, type Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Scope } from '@wildshard/engine/app/scope';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import type { WholeGeometryPiece } from '../plugin/geometry';
import type { ShardProduct } from './shardProduct';
import { SharedTileBuilds, type TileContent } from './tileContent';
import type { ControlRefinement } from './controlRefinement';
import { readWholePieces } from './wholePieces';

type Library = Extract<WorldScenesSection['libraries'][number], { kind: 'whole' }>;
function raw(attribute: BufferAttribute | InterleavedBufferAttribute, vertex: number, lane: number): number | undefined {
  return attribute instanceof InterleavedBufferAttribute ? attribute.data.array[vertex * attribute.data.stride + attribute.offset + lane] : attribute.array[vertex * attribute.itemSize + lane];
}
/** Validate the active original pieces before publishing a new one-draw union.
 * A shared vertex must retain every native lane, including signed zero. */
export function joinWholePieces(pieces: readonly WholeGeometryPiece[], pose?: readonly number[]): BufferGeometry {
  const first = pieces[0]; if (first === undefined) return new BufferGeometry();
  const vertices = new Map<number, { readonly piece: WholeGeometryPiece; readonly local: number }>(), triangles = new Set<number>();
  for (const piece of pieces) {
    if (piece.part !== first.part || piece.layout !== first.layout || !piece.matrix.equals(first.matrix)
      || piece.vertexCount !== first.vertexCount || piece.indexCount !== first.indexCount) throw new Error('Whole source layout or transform differs');
    for (const triangle of piece.triangles) { if (triangles.has(triangle)) throw new Error('Whole duplicate or invalid triangle'); triangles.add(triangle); }
    for (const [local, ordinal] of piece.vertices.entries()) {
      const prior = vertices.get(ordinal);
      if (prior === undefined) { vertices.set(ordinal, { piece, local }); continue; }
      for (const [name, attribute] of Object.entries(piece.geometry.attributes)) {
        const other = prior.piece.geometry.getAttribute(name);
        if (other === undefined || attribute.itemSize !== other.itemSize) throw new Error('Whole channel layout differs');
        for (let lane = 0; lane < attribute.itemSize; lane++) if (!Object.is(raw(attribute, local, lane), raw(other, prior.local, lane))) throw new Error('Whole shared vertex differs');
      }
    }
  }
  const copies: BufferGeometry[] = [];
  try {
    // Apply the original draw's matrix and its declared alias in the same order
    // and Float32 boundaries as readWholeLibrary. There is still one mesh/draw.
    for (const piece of pieces) {
      const copy = piece.geometry.clone().applyMatrix4(piece.matrix); copies.push(copy);
      if (pose !== undefined) copy.applyMatrix4(new Matrix4().fromArray(pose));
    }
    const joined = mergeGeometries(copies, false);
    if (joined === null) throw new Error('Whole piece channels cannot join');
    return joined;
  } finally { for (const copy of copies) copy.dispose(); }
}

/** Resident fine geometry lives only in held ring tiles. Named mesh/material,
 * frozen bounds and collision owners remain stable as original pieces append. */
export class RefiningWholeLibrary {
  private readonly files = new Map<number, readonly string[]>();
  private readonly builds: SharedTileBuilds<readonly WholeGeometryPiece[]>;
  private serial = 0;
  constructor(private readonly owner: Scope, product: ShardProduct, private readonly row: Library, private readonly queue: ControlRefinement, private readonly cover: (tile: number) => Promise<void>) {
    const wanted = new Set(row.models.flatMap(model => model.files));
    const declared = new Map(product.shardfile.files.map(file => [file.hash, file]));
    for (const tile of product.shardfile.tiles) if (tile.lod === 0) {
      const files = tile.files.filter(hash => wanted.has(hash));
      if (files.length > 0) this.files.set(tile.z * 8 + tile.x, files);
    }
    const fine = new Set([...this.files.values()].flat());
    for (const hash of wanted) if (!fine.has(hash) || declared.get(hash)?.kind !== 'glb') throw new Error('Refinement requires declared fine geometry');
    this.builds = new SharedTileBuilds(owner, async (tile, scope) => {
      const hashes = this.files.get(tile); if (hashes === undefined) throw new Error('Missing refinement tile');
      const pieces: WholeGeometryPiece[] = [];
      scope.onDispose(() => { for (const piece of pieces) piece.geometry.dispose(); pieces.length = 0; });
      const at = { x: -250 + (tile % 8 + 0.5) * 62.5, z: -250 + (Math.floor(tile / 8) + 0.5) * 62.5 };
      await queue.add(`${row.id}:${String(tile)}:${String(this.serial++)}`, at, async () => {
        if (scope.disposed || scope.disposing) return;
        await this.cover(tile);
        for (const hash of hashes) {
          if (scope.disposed || scope.disposing) return;
          let read: readonly WholeGeometryPiece[];
          try { read = await readWholePieces(scope, product, hash); }
          catch (error) { if (scope.disposed || scope.disposing) return; throw error; }
          if (scope.disposed || scope.disposing) { for (const piece of read) piece.geometry.dispose(); return; }
          pieces.push(...read);
        }
      });
      return pieces;
    });
  }
  geometry(id: string): BufferGeometry | null { return this.row.models.some(model => model.id === id) ? new BufferGeometry() : null; }
  bind(id: string, mesh: Mesh, lifetime: Scope): TileContent {
    const model = this.row.models.find(candidate => candidate.id === id); if (model === undefined) throw new Error('Missing refining model');
    const files = new Set(model.files), tiles = new Set([...this.files].filter(([, hashes]) => hashes.some(hash => files.has(hash))).map(([key]) => key));
    const held = new Map<number, readonly WholeGeometryPiece[]>(), sphere = mesh.geometry.boundingSphere?.clone(), box = mesh.geometry.boundingBox?.clone();
    let closed = false, owned: BufferGeometry | undefined;
    const redraw = (): void => {
      if (closed || this.owner.disposed || this.owner.disposing) return;
      const geometry = joinWholePieces([...held.values()].flat(), model.matrix);
      if (sphere !== undefined) geometry.boundingSphere = sphere.clone();
      if (box !== undefined) geometry.boundingBox = box.clone();
      ownSceneResource(geometry, lifetime);
      const previous = owned; mesh.geometry = geometry; owned = geometry; previous?.dispose();
    };
    lifetime.onDispose(() => { closed = true; held.clear(); owned?.dispose(); owned = undefined; });
    return { id: `refine:${this.row.id}:${id}:${mesh.uuid}`, tiles: () => tiles, ready: () => this.queue.ready,
      attach: async (tile, scope) => {
        if (!tiles.has(tile) || closed || scope.disposed || scope.disposing) return;
        const read = await this.builds.hold(tile, scope);
        if (closed || scope.disposed || scope.disposing) return;
        const pieces = read.filter(piece => piece.part === model.part);
        if (pieces.length === 0) throw new Error('Fine tile omits its declared whole partition');
        held.set(tile, pieces);
        try { redraw(); } catch (error) { held.delete(tile); throw error; }
        scope.onDispose(() => { held.delete(tile); redraw(); });
      } };
  }
}
