/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * Drawn by runtime/looks/streamedCover.ts from the rows in data/coverLook.ts and the graphs of data/lookGraphs.json: one InstancedMesh per plant (two,
 * E186: written and uploaded behind, swapped in one frame), refilled from 16 m cells round the viewer every 4 m, each
 * plant at its own edge in its kind's reach (E117: no ring, no pop), a far tier of stand-ins past the near set (E117
 * follow-up: "more distant cover"), plants on sloping ground keeping their reach further (E156 C), and the plants fading
 * into the colour the ground wears (E156: coverTint.ts's grid, compiled from the same rules). Where a plant may stand,
 * how dense each kind is there and its tint are baked per cell at build (generators/coverCells.ts, coverSites.ts).
 *
 *   const cover = new GroundCover(sky, { cells, grid: admitted }).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * No URL switches (Jake, 2026-09-25); every decided Debug row is gone (E318).
 */
import * as THREE from 'three';
import { DUNE_LOGS_GEOMETRY } from '../runtime/boot/fixedGeometry';
import duneLogs from '../data/duneLogsBake.json' with { type: 'json' };
import { copyCoverGeometry } from '../runtime/boot/coverGeometry';
import { GROUND_COVER } from '../data/coverLook';
import { CoverGrid } from './coverTint';
import { driftLog } from '../runtime/models/cargo';
import { modelContext } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { StreamedCover } from '../runtime/looks/streamedCover';

export interface GroundCoverOpts {
  /** the baked cells (world/cover/cells/<tier>.bin) */
  cells: Uint8Array;
  /** Borrowed validated full-grid file, including the authored Blender overlay. */
  grid: Parameters<typeof CoverGrid.create>;
}

export class GroundCover extends StreamedCover {
  /** its placements: the dune line's drift logs (the named places' sets read them) */
  readonly placed: Placed[] = [];
  constructor(private readonly sky: Sky, private readonly opts: GroundCoverOpts) {
    super({ row: GROUND_COVER, geometry: copyCoverGeometry(), cells: opts.cells, heightAt });
  }

  override build(): this {
    super.build();
    CoverGrid.create(...this.opts.grid);
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
  }

  /** bleached driftwood logs (the E149 painter, driftwood.ts) along the dune line all round the island, one every ~9 m (one static mesh) */
  private buildDriftwood(): void {
    const geo = DUNE_LOGS_GEOMETRY.take();
    const mesh = new THREE.Mesh(geo, lowPolyLookMaterial(this.sky));
    mesh.name = 'ground-cover-driftwood';
    mesh.userData['coverProp'] = true; // static logs, not instanced cover: the perf probe's cover rows leave it (E405)
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    // E315 M1: each is the drift log model (src/shards/driftwood-isle/runtime/models/cargo.ts), placed drawnInto this mesh
    if (duneLogs.placements.length > 0) this.placed.push(place(driftLog, duneLogs.placements, { ctx: modelContext(this.sky), draw: 'merged', drawnInto: { object: mesh, boxes: Float32Array.from(duneLogs.boxes) }, piece: { id: 'cover-drift-logs' } }));
  }
}
