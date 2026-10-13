import { expect, it } from 'vitest';
import { Group } from 'three';
import { ClientChannels } from '../src/sdk/clientChannels';
import { createClientChannelView, moverChannelViews } from '../src/game/plugin/ui';
import { parseClientChannels } from '@wildshard/format/clientChannels';

it('binds only finite declared transforms to private scene objects and keeps the original Euler order', () => {
  const row = new ClientChannels('winch'); row.fromMover('fixture.winch');
  for (const [property, read] of [['pitch', 'euler.x'], ['yaw', 'euler.y'], ['roll', 'euler.z']] as const) {
    row.output(property, row.read(read)); row.bind(property, 'hinge', 'YXZ');
  }
  const actual = new Group(), expected = new Group(), views = moverChannelViews([row.build()], new Map([['hinge', actual]]), ['fixture.winch']);
  const view = views.get('fixture.winch'); if (view === undefined) throw new Error('Missing fixture view');
  for (const angles of [[0, 0, 0], [0.53, -1.12, 0.07], [-2.4, 0.117, 2.9]] as const) {
    expected.rotation.set(angles[0], angles[1], angles[2], 'YXZ');
    view.pose({ position: { x: 0, y: 0, z: 0 }, euler: { x: angles[0], y: angles[1], z: angles[2] }, enabled: true }, {});
    expect(actual.rotation.toArray()).toEqual(expected.rotation.toArray());
    expect(actual.quaternion.toArray()).toEqual(expected.quaternion.toArray());
  }
});

it('copies mover fields into a frozen observer after the exact visual pose, with no native body or clock', () => {
  const row = new ClientChannels('observe'); row.fromMover('fixture.winch');
  row.output('pitch', row.read('euler.x')); row.bind('pitch', 'hinge', 'YXZ');
  row.output('value', row.read('enabled')); row.output('turn', row.read('field.6'));
  const hinge = new Group(), seen: unknown[] = [];
  const views = moverChannelViews([row.build()], new Map([['hinge', hinge]]), ['fixture.winch', 'fixture.native'], (id, frame) => {
    seen.push([id, hinge.rotation.x, frame.value, frame.turn]); expect(Reflect.set(frame, 'player.health', 2)).toBe(false);
  });
  const pose = { position: { x: 1, y: 2, z: 3 }, euler: { x: 0.7, y: 0, z: 0 }, enabled: true }, fields = { 6: 1 };
  views.get('fixture.winch')?.pose(pose, fields);
  expect(seen).toEqual([['fixture.winch', 0.7, 1, 1]]);
  expect(pose).toEqual({ position: { x: 1, y: 2, z: 3 }, euler: { x: 0.7, y: 0, z: 0 }, enabled: true });
  expect(fields).toEqual({ 6: 1 });
  expect(() => views.get('fixture.native')?.pose(pose, fields)).not.toThrow();
});

it('refuses unknown, duplicate or authoritative targets and unsupported mover observations', () => {
  const row = new ClientChannels('refuse'); row.fromMover('fixture.winch'); row.output('pitch', row.read('euler.x')); row.bind('pitch', 'hinge');
  const program = row.build();
  for (const target of [{ position: { x: 0, y: 0, z: 0 }, health: 100 }, { flags: new Set() }, undefined]) {
    expect(() => createClientChannelView(program, new Map([['hinge', target]]))).toThrow('private scene object');
  }
  expect(() => createClientChannelView(program, new Map())).toThrow();
  expect(() => moverChannelViews([program], new Map([['hinge', new Group()]]), [])).toThrow();
  expect(() => moverChannelViews([program, program], new Map([['hinge', new Group()]]), ['fixture.winch'])).toThrow();
  expect(() => moverChannelViews([], new Map(), ['same', 'same'])).toThrow();
  expect(() => parseClientChannels([{ ...program, reads: ['player.health'] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, nodes: [{ op: 'clock', value: 'time' }] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, bindings: [{ property: 'value', target: 'shared.score' }] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, bindings: [{ property: 'pitch', target: 'hinge' }, { property: 'pitch', target: 'hinge' }] }])).toThrow();
});
