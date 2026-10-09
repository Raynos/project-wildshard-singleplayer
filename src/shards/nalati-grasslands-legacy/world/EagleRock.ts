/**
 * EagleRock — the granite tor on the west rim (map-01 "EAGLE ROCK", the Tianjie-terrace view): places the Eagle Rock
 * model (E306 / E315 M3, src/shards/nalati-grasslands/models/eagleRock.ts — the tor, its scramble and its summit deck)
 * on B0's knoll, painted into its own mesh.
 *
 *   const rock = buildEagleRock(ctx);   // PoiPiece: the tor registers itself (`register`: one `place`)
 */
import { PaintKit } from './paint';
import { NalatiSet } from './painted';
import { EAGLE_ROCK } from './layout';
import type { PoiCtx, PoiPiece } from './types';
import { eagleRock } from '../models/eagleRock';

export function buildEagleRock(ctx: PoiCtx): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xea61);
  const set = new NalatiSet(kit, ctx);
  set.paint(eagleRock, { x: EAGLE_ROCK.x, y: EAGLE_ROCK.top, z: EAGLE_ROCK.z, yaw: 0 }, {});
  const mesh = kit.mesh(sky, { ground, aoH: 1.4 });
  mesh.name = 'nalati-eagle-rock';
  return { name: 'eagleRock', object: mesh, colliders: set.boxes, surface: 'rock', tris: mesh.geometry.getAttribute('position').count / 3, register: (o) => set.register({ ...o, object: mesh }) };
}
