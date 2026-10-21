import { expect, test } from 'vitest';
import * as v from 'valibot';
import { KitFigureSchema } from '../src/format/kitFigure';
import { FIGURE_CATALOGUE } from '../src/shards/driftwood-isle/generators/figureCatalogue';
import { kitFocusProgram } from '../src/shards/driftwood-isle/generators/npcFocusPrograms';

/** An unrelated harbour's net-mender: a kit figure that mends on a timer when you are away and lifts the net on a signal. */
const mender = {
  scene: { recipe: { version: 1, root: 'mender', materials: [], nodes: [] }, parts: { figure: 'group', arm: 'object' },
    bindings: { figure: { kind: 'group', part: 'figure' }, arm: { kind: 'object', part: 'arm' } } },
  material: 'still', neck: 1.4, hide: false,
  pose: [{ bone: 'figure', channel: 'rotation.y', cases: [{ sum: [{ of: [{ mem: 'turn' }] }] }] },
    { bone: 'arm', channel: 'rotation.x', cases: [{ when: { mem: { key: 'gesture', atLeast: 2 } }, sum: [{ of: [-1.1, { mem: 'weight' }] }] },
      { sum: [{ of: [{ bounded: [{ of: [{ wave: 'phase', rate: 3 }] }], min: 0 }, 0.4] }] }] }],
  gestures: [{ id: 'mend', code: 1, seconds: 3, eased: true, starts: [{ kind: 'every', base: 6, span: 1, frequency: 0.7, first: 2, from: 8, to: 1e6 }], turns: false, look: { yaw: 0, pitch: 0.5 } },
    { id: 'lift', code: 2, seconds: 1.5, eased: true, starts: [{ kind: 'signal' }], turns: true, offer: { yaw: 0.2, pitch: 0.1, within: 6 } }],
};

test('kit figure rows admit an unrelated harbour mender and Driftwood\'s two people', () => {
  const rows = v.parse(KitFigureSchema, mender);
  expect(rows.gestures.map(row => row.id)).toEqual(['mend', 'lift']);
  expect(rows.pose).toHaveLength(2);
  for (const id of ['castaway', 'trader']) expect(v.safeParse(KitFigureSchema, FIGURE_CATALOGUE.figures[id]?.kit).success).toBe(true);
});

test('a mender\'s exponential, cycle-cadence attention compiles as one focus program', () => {
  const program = kitFocusProgram('mender', { range: 5, rate: 2, maxSpeed: 1.5 }, { range: 8, yawLimit: 1, pitchScale: 1, eyeHeight: 1.6, minimumDistance: 0.5,
    response: 'exponential', rate: 4, clampAfterOffset: false, idle: { cadence: { kind: 'cycle', base: 3, frequency: 1, span: 2 }, yaw: [0.3, 0.6], pitch: 0.1 } });
  expect(program.numeric?.group).toBe('npc.mender');
  expect(program.numeric?.outputs.map(row => row.path[0])).toEqual(['turn', 'headYaw', 'headPitch', 'glanceT', 'glanceYaw', 'glancePitch']);
});

test('kit figure rows refuse a callback, an unknown start and clip nesting past three', () => {
  expect(v.safeParse(KitFigureSchema, { ...mender, update: () => undefined }).success).toBe(false);
  expect(v.safeParse(KitFigureSchema, { ...mender, gestures: [{ ...mender.gestures[1], starts: [{ kind: 'script' }] }] }).success).toBe(false);
  const deep = { bounded: [{ of: [{ bounded: [{ of: [{ bounded: [{ of: [{ bounded: [1] }] }] }] }] }] }] };
  expect(v.safeParse(KitFigureSchema, { ...mender, pose: [{ bone: 'arm', channel: 'scale', cases: [{ sum: [{ of: [deep] }] }] }] }).success).toBe(false);
});
