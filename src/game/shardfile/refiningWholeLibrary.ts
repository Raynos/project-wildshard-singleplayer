import { BufferGeometry, type Mesh } from 'three';
import { workSlice } from '@wildshard/engine/core/workSlice';
import { joinWholePieceSteps } from './wholePieceJoin';
import type { Scope } from '@wildshard/engine/app/scope';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';
import type { WholeGeometryPiece } from '../plugin/geometry';
import type { ShardProduct } from './shardProduct';
import { SharedTileBuilds, type TileContent } from './tileContent';
import type { ControlRefinement } from './controlRefinement';
import { readWholePieces } from './wholePieces';

type Library = Extract<WorldScenesSection['libraries'][number], { kind: 'whole' }>;
/** The same exact join cursor is also available to synchronous oracles and
 * retirement, where publication must finish before a tile releases its lease. */
export function joinWholePieces(pieces: readonly WholeGeometryPiece[], pose?: readonly number[], forceIdentityTransform = false): BufferGeometry {
  const steps = joinWholePieceSteps(pieces, pose, forceIdentityTransform);
  for (;;) {
    const next = steps.next();
    if (next.done) {
      if (next.value === undefined) throw new Error('Whole piece join did not complete');
      return next.value;
    }
  }
}

/** Resident fine geometry lives only in held ring tiles. Named mesh/material,
 * frozen bounds and collision owners remain stable as original pieces append. */
export class RefiningWholeLibrary {
  private readonly files = new Map<number, readonly string[]>();
  private readonly builds: SharedTileBuilds<readonly WholeGeometryPiece[]>;
  private serial = 0;
  private readonly handed = new Set<string>();
  private readonly transforms = new WeakMap<BufferGeometry, boolean>();
  constructor(private readonly owner: Scope, product: ShardProduct, private readonly row: Library, private readonly queue: ControlRefinement, private readonly cover: (tile: number) => Promise<void>) {
    const wanted = new Set(row.models.flatMap(model => model.files));
    const declared = new Map(product.shardfile.files.map(file => [file.hash, file]));
    for (const tile of product.shardfile.tiles) if (tile.lod === 0) {
      const files = tile.files.filter(hash => wanted.has(hash));
      if (files.length > 0) this.files.set(tile.z * 8 + tile.x, files);
    }
    const fine = new Set([...this.files.values()].flat());
    for (const hash of wanted) if (!fine.has(hash) || declared.get(hash)?.kind !== 'glb') throw new Error(`Refinement requires declared fine geometry: ${row.id} ${hash}`);
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
  geometry(id: string): BufferGeometry | null {
    const model = this.row.models.find(candidate => candidate.id === id); if (model === undefined) return null;
    const geometry = new BufferGeometry(); this.transforms.set(geometry, this.handed.has(model.part)); this.handed.add(model.part);
    return geometry;
  }
  /** Repeat aliases take the original full reader's transform branch, even for identity. */
  sourceTransform(geometry: BufferGeometry): boolean { return this.transforms.get(geometry) ?? false; }
  bind(id: string, mesh: Mesh, lifetime: Scope, forceIdentityTransform = false): TileContent {
    const model = this.row.models.find(candidate => candidate.id === id); if (model === undefined) throw new Error('Missing refining model');
    const files = new Set(model.files), tiles = new Set([...this.files].filter(([, hashes]) => hashes.some(hash => files.has(hash))).map(([key]) => key));
    const held = new Map<number, readonly WholeGeometryPiece[]>(), sphere = mesh.geometry.boundingSphere?.clone(), box = mesh.geometry.boundingBox?.clone();
    let closed = false, owned: BufferGeometry | undefined, revision = 0, published = 0;
    let building: Promise<void> | undefined;
    const retired = (): boolean => closed || this.owner.disposed || this.owner.disposing || lifetime.disposed || lifetime.disposing;
    const publish = (geometry: BufferGeometry): void => {
      if (sphere !== undefined) geometry.boundingSphere = sphere.clone();
      if (box !== undefined) geometry.boundingBox = box.clone();
      ownSceneResource(geometry, lifetime);
      const previous = owned; mesh.geometry = geometry; owned = geometry; previous?.dispose();
    };
    // Retirement remains synchronous: no disposed fine tile survives in the
    // draw while an asynchronous replacement is prepared.
    const redraw = (): void => {
      revision++;
      if (retired()) return;
      publish(joinWholePieces([...held.values()].flat(), model.matrix, forceIdentityTransform)); published = revision;
    };
    const redrawSliced = (): Promise<void> => {
      revision++;
      if (building !== undefined) return building;
      const drain = async (): Promise<void> => {
        const slice = workSlice(undefined, lifetime);
        while (!retired() && published < revision) {
          const generation = revision, steps = joinWholePieceSteps([...held.values()].flat(), model.matrix, forceIdentityTransform);
          try {
            for (;;) {
              if (retired() || generation !== revision) break;
              const next = steps.next();
              if (next.done) {
                if (next.value === undefined) throw new Error('Whole piece join did not complete');
                publish(next.value); published = generation; break;
              }
              const pause = slice.check(); if (pause !== undefined) await pause;
            }
          } catch (error) { if (!retired()) throw error; }
          finally { steps.return(undefined); }
        }
      };
      const pending = drain(); building = pending;
      const complete = (): void => { if (building === pending) building = undefined; };
      void pending.then(complete, complete);
      return pending;
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
        scope.onDispose(() => { if (held.get(tile) === pieces) { held.delete(tile); redraw(); } });
        // A concurrent arrival joins the same publication promise. Never mark
        // its fine tile ready while a stale generation is still being rebuilt.
        try { await redrawSliced(); } catch (error) { if (held.get(tile) === pieces) held.delete(tile); throw error; }
      } };
  }
}
