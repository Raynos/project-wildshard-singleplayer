// moverCopies — a mover model's copies placed on their paths (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts): one
// object per path (a train, a gondola, drones), each placed where its path puts it at t = 0 (pathMovers `moverStart`), all
// named for the budget ruler's lane, handed back with their paths for the world's update to move (pathMovers `moveAlong`).
//
//   const running = placeMovers(drone, DRONE_PATHS, { ctx, parent: root, id: 'my-drones', name: 'movers' });
//   for (const m of running) moveAlong(m.body, m.path, t);
import type { Object3D } from 'three';
import type { ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import { type MoverPath, moverStart } from './pathMovers';

/** one placed mover: its object and the path it runs */
export interface RunningMover { body: Object3D; path: MoverPath }

/** Place one copy of `model` per path (piece `id`, every object named `name`) and hand back each copy with its path. */
export function placeMovers(model: ModelDef<object>, paths: readonly MoverPath[], opts: { readonly ctx: ModelContext; readonly parent: Object3D; readonly id: string; readonly name: string }): RunningMover[] {
  const placed = place(model, paths.map(moverStart), { ctx: opts.ctx, draw: 'single', parent: opts.parent, piece: { id: opts.id } });
  const copies = paths.length === 1 ? [placed.object] : [...placed.object.children];
  placed.object.name = opts.name;
  for (const o of copies) o.name = opts.name;
  return paths.flatMap((path, i) => { const body = copies[i]; return body === undefined ? [] : [{ body, path }]; });
}
