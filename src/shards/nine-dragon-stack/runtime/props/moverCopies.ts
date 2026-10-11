// Decorative copies consume declared, read-only channels on the original continuous page clock.
// Their private draw transforms never move a collider or publish authoritative state.
import type { Object3D } from 'three';
import type { ModelContext, ModelDef } from '@wildshard/engine/models/model';
import { place } from '@wildshard/engine/models/place';
import { createClientChannels } from '@wildshard/game/plugin/ui';
import type { ClientChannelProgram } from '@wildshard/format/clientChannels';

/** One private decorative copy, with no authoritative body or write port exposed. */
export interface RunningMover { readonly advance: (time: number) => void }

/** Place one copy per declared visual program and retain its original t=0 placement and naming. */
export function placeMovers(model: ModelDef<object>, programs: readonly ClientChannelProgram[], opts: { readonly ctx: ModelContext; readonly parent: Object3D; readonly id: string; readonly name: string }): RunningMover[] {
  const observation = { time: 0, delta: 0, values: [] as readonly number[] };
  const missingPosition = new Error('Missing declared decorative position');
  const views = programs.map(program => { const view = createClientChannels(program); view.evaluate(observation); return view; });
  const placed = place(model, views.map(({ frame }) => {
    const { x, y, z, yaw } = frame;
    if (x === undefined || y === undefined || z === undefined) throw new Error('Missing declared decorative position');
    return { x, y, z, ...(yaw === undefined ? {} : { yaw }) };
  }), { ctx: opts.ctx, draw: 'single', parent: opts.parent, piece: { id: opts.id } });
  const copies = programs.length === 1 ? [placed.object] : [...placed.object.children];
  placed.object.name = opts.name;
  for (const o of copies) o.name = opts.name;
  return views.map((view, index) => {
    const body = copies[index]; if (body === undefined) throw new Error('Missing declared decorative copy');
    return { advance: time => {
      observation.time = time; view.evaluate(observation);
      const { x, y, z, yaw } = view.frame;
      if (x === undefined || y === undefined || z === undefined) throw missingPosition;
      body.position.set(x, y, z); if (yaw !== undefined) body.rotation.y = yaw;
    } };
  });
}
