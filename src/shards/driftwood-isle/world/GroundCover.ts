/**
 * GroundCover — Driftwood Isle's ground cover near the player (remaster M4): instanced low-poly grass tufts, ferns,
 * hibiscus, white daisies and mossy pebbles on the grass, sparse sun-bleached beach grass on the sand, and a thicker
 * fern understorey in the shrine jungle. So the island interior stops reading as empty planes.
 *
 * Drawn by the game streamed-cover host from data/groundCover.json and the graphs of data/lookGraphs.json: one InstancedMesh per plant (two,
 * E186: written and uploaded behind, swapped in one frame), refilled from 16 m cells round the viewer every 4 m, each
 * plant at its own edge in its kind's reach (E117: no ring, no pop), a far tier of stand-ins past the near set (E117
 * follow-up: "more distant cover"), plants on sloping ground keeping their reach further (E156 C), and the plants fading
 * into the colour the ground wears (E156: the baked cover map, world/islandCover.ts, compiled from the same rules). Where a plant may stand,
 * how dense each kind is there and its tint are baked per cell at build (generators/coverCells.ts, coverSites.ts).
 *
 *   const cover = new GroundCover(sky, { cells }, scenes).build();
 *   scene.add(cover.group);
 *   game.onUpdate((dt) => cover.update(dt, player.position));
 *
 * No URL switches (Jake, 2026-09-25); every decided Debug row is gone (E318).
 */
import type * as THREE from 'three';
import { fixedDraw, fixedGeometryGroups } from '../runtime/boot/blobAssets';
import authoredCoverLook from '../data/groundCover.json' with { type: 'json' };
import type { Placed } from '@wildshard/engine/models/place';
import type { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { createStreamedCover, type StreamedCoverHandle } from '@wildshard/game/looks/streamedCover';

const { GROUND_COVER } = authoredCoverLook;

export interface GroundCoverOpts {
  /** the baked cells (world/cover/cells/<tier>.bin) */
  cells: Uint8Array;
}

export class GroundCover {
  private readonly stream: StreamedCoverHandle;
  readonly group: THREE.Group;
  readonly stats: StreamedCoverHandle['stats'];
  /** its placements: the dune line's drift logs (the named places' sets read them) */
  readonly placed: Placed[] = [];
  constructor(opts: GroundCoverOpts, private readonly resources: SceneHandles, logs: Placed) {
    for (const [kind, slot] of Object.entries(fixedGeometryGroups().cover)) resources.publish(kind, fixedDraw(slot).copy());
    this.stream = createStreamedCover(resources, GROUND_COVER, opts.cells);
    this.group = this.stream.group; this.stats = this.stream.stats; this.placed.push(logs);
  }

  build(): this {
    this.buildDriftwood();
    this.group.name = 'ground-cover';
    return this;
  }

  update(dt: number, viewer: THREE.Vector3): void { this.stream.update(dt, viewer); }

  /** bleached driftwood logs (the E149 painter, driftwood.ts) along the dune line all round the island, one every ~9 m (one static mesh) */
  private buildDriftwood(): void {
    const mesh = this.resources.mesh('logs.mesh');
    mesh.userData['coverProp'] = true;
    this.group.add(mesh);
  }
}
