import { expect, it } from 'vitest';
import { Group } from 'three';
import { ClientChannels } from '../src/sdk/clientChannels';
import { createClientChannelView, bindClientChannels } from '../src/game/plugin/ui';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { SIGNAL_BUCKET_CHANNELS } from '../src/shards/sunscar-dunes/data/bucketMotion';

it('keeps the actual Signal ramp, boot-only oil input and prompt phase exact', () => {
  const bucket = new Group(), rope = new Group(), originalBucket = new Group(), originalRope = new Group();
  const bound = bindClientChannels(SIGNAL_BUCKET_CHANNELS, { targets: new Map([['bucket', bucket], ['rope', rope]]) });
  const original = createClientChannelView(SIGNAL_BUCKET_CHANNELS[0], new Map([['bucket', originalBucket], ['rope', originalRope]]));
  const program = SIGNAL_BUCKET_CHANNELS[0]; if (program === undefined) throw new Error('Missing actual bucket program');
  expect(bound.interactables).toEqual([]);
  const boot = { time: 0, delta: 0, values: [0, 0, 2.5] };
  original.evaluate(boot); bound.evaluate(program.id, boot);
  let bindings = 0, granted = false;
  bound.bindPrompts(() => { bindings++; return () => { granted = true; }; });
  expect(bindings).toBe(1); expect(bound.interactables).toHaveLength(1);
  for (const [index, delta] of [0, 1 / 60, 0.17, 0.33, 0.5, 1 / 30, 0.2].entries()) {
    const frame = { time: index / 30, delta, values: [Number(index > 2), Number(index > 0), 2.5] };
    original.evaluate(frame); bound.evaluate(program.id, frame);
    expect(bucket.position.toArray()).toEqual(originalBucket.position.toArray());
    expect(rope.scale.toArray()).toEqual(originalRope.scale.toArray());
    expect(bound.view(program.id).frame).toEqual(original.frame);
  }
  const prompt = SIGNAL_BUCKET_CHANNELS[1]; if (prompt === undefined) throw new Error('Missing actual prompt program');
  bound.evaluate(prompt.id, { time: 0, delta: 0, values: [12.75, 3.125, -87] });
  expect(bound.prompt(prompt.id).position.toArray()).toEqual([12.75, 3.125, -87]);
  expect(granted).toBe(false); bound.prompt(prompt.id).onInteract(); expect(granted).toBe(true);
  expect(() => bound.bindPrompts(() => () => undefined)).toThrow('already bound');
  expect(bindings).toBe(1);
});

it('binds only finite declared transforms to private scene objects and keeps the original Euler order', () => {
  const row = new ClientChannels('winch'); row.fromMover('fixture.winch');
  for (const [property, read] of [['pitch', 'euler.x'], ['yaw', 'euler.y'], ['roll', 'euler.z']] as const) {
    row.output(property, row.read(read)); row.bind(property, 'hinge', 'YXZ');
  }
  const actual = new Group(), expected = new Group(), views = bindClientChannels([row.build()], { targets: new Map([['hinge', actual]]), nativeOwners: ['fixture.winch'] }).movers;
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
  const views = bindClientChannels([row.build()], { targets: new Map([['hinge', hinge]]), nativeOwners: ['fixture.winch', 'fixture.native'], observed: (id, frame) => {
    seen.push([id, hinge.rotation.x, frame.value, frame.turn]); expect(Reflect.set(frame, 'player.health', 2)).toBe(false);
  } }).movers;
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
  expect(() => bindClientChannels([program], { targets: new Map([['hinge', new Group()]]), nativeOwners: [] })).toThrow();
  expect(() => bindClientChannels([program, program], { targets: new Map([['hinge', new Group()]]), nativeOwners: ['fixture.winch'] })).toThrow();
  expect(() => bindClientChannels([], { targets: new Map(), nativeOwners: ['same', 'same'] })).toThrow();
  expect(() => parseClientChannels([{ ...program, reads: ['player.health'] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, nodes: [{ op: 'clock', value: 'time' }] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, bindings: [{ property: 'value', target: 'shared.score' }] }])).toThrow();
  expect(() => parseClientChannels([{ ...program, bindings: [{ property: 'pitch', target: 'hinge' }, { property: 'pitch', target: 'hinge' }] }])).toThrow();
});
