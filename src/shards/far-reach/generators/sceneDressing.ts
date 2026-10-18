import { ClientChannels } from '@wildshard/sdk/clientChannels';
import type { SceneMotion } from '@wildshard/format/sceneMotion';
import routeScene from '../data/routeScene.generated.json' with { type: 'json' };

const { SKY_VANES } = routeScene;

const deck = new ClientChannels('far.dressing.deck');
const riding = deck.read('riding');
deck.output('value', deck.select(riding,
  deck.binary('add', deck.constant(0.9), deck.binary('mul', deck.unary('sin', deck.binary('mul', deck.clock('time'), deck.constant(4))), deck.constant(0.15))),
  deck.constant(0.25)));
deck.output('turn', deck.select(riding, deck.constant(0.75), deck.constant(0.16)));
const frames: SceneMotion['frames'] = [{ id: 'deck', program: 'far.dressing.deck', targets: {}, inputs: { riding: { mode: 'board' } },
  materials: [{ channel: 'value', material: 'routes.glass', property: 'emissiveIntensity' },
    { channel: 'turn', material: 'routes.glass', property: 'opacity' }] }];
const programs = [deck.build()];
for (const cube of ['standalone', 'cell'] as const) {
  const id = `far.dressing.mill-${cube}`, part = `fixed-${cube}.millHub`, mill = new ClientChannels(id);
  const angle = mill.local({ read: 'angle' }), next = mill.binary('add', angle, mill.binary('mul', mill.clock('delta'), mill.constant(0.35)));
  mill.retain(angle, next); mill.output('roll', next); mill.bind('roll', 'mill');
  programs.push(mill.build());
  frames.push({ id: `mill-${cube}`, cube, program: id, targets: { mill: part }, inputs: { angle: { part, property: 'roll' } }, materials: [] });
}
for (const row of SKY_VANES.rows) {
  const id = `far.dressing.${row.id}`, part = `vanes.${row.rotor}`, vane = new ClientChannels(id);
  const angle = vane.local({ read: 'angle' }), speed = vane.select(vane.read('turned'), vane.constant(6), vane.constant(0.25));
  const next = vane.binary('add', angle, vane.binary('mul', vane.clock('delta'), speed));
  vane.retain(angle, next); vane.output('yaw', next); vane.bind('yaw', 'rotor');
  programs.push(vane.build());
  frames.push({ id: row.id, program: id, targets: { rotor: part }, inputs: { angle: { part, property: 'yaw' }, turned: { flag: row.flag } }, materials: [] });
}
/** Exact previous per-frame scalar operations, addressed through scene ids. */
export const SKY_DRESSING_PROGRAMS = programs;
export const SKY_DRESSING_FRAMES = frames;
