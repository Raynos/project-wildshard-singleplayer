import { expect, it } from 'vitest';
import { ClientChannels } from '../src/sdk/clientChannels';
import { parseClientChannels, ClientChannelsSchema, ClientChannelProgramSchema, CLIENT_CHANNEL_LIMITS } from '@wildshard/format/clientChannels';
import { createClientChannels } from '../src/game/plugin/ui';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/format/shardSchema';
import { withoutRuntimeRows } from '../src/game/plugin/headless';
import { DeclaredScriptWorld } from '../src/engine/script/state';
import { formatJsonSchema, formatJsonSchemas } from '../src/sdk/formatJsonSchema';

function program() {
  const row = new ClientChannels('fixture');
  row.output('x', row.constant(3));
  return row.build();
}

it('executes the documented continuous-clock example without quantizing time or wrapping yaw', () => {
  const row = new ClientChannels('orbit'), angle = row.binary('mul', row.clock('time'), row.constant(0.045));
  row.output('x', row.binary('add', row.constant(8), row.binary('mul', row.unary('cos', angle), row.constant(22))));
  row.output('yaw', row.unary('neg', angle));
  const view = createClientChannels(row.build()), time = 1000.1234567;
  view.evaluate({ time, delta: 1 / 59.94, values: [] });
  expect(Object.is(view.frame.x, 8 + Math.cos(time * 0.045) * 22)).toBe(true);
  expect(Object.is(view.frame.yaw, -(time * 0.045))).toBe(true);
  expect(Math.abs(view.frame.yaw ?? 0)).toBeGreaterThan(Math.PI);
});

it('refuses cycles, calls, unbounded expressions and nonvisual channels before allocation', () => {
  const row = program();
  for (const nodes of [[{ op: 'sin', a: 0 }], [{ op: 'constant', value: 1 }, { op: 'sin', a: 2 }],
    [{ op: 'read', index: 0 }], [{ op: 'call', name: 'tick' }], [{ op: 'constant', value: Infinity }]]) {
    expect(() => createClientChannels({ ...row, nodes })).toThrow();
  }
  expect(() => parseClientChannels([{ ...row, nodes: Array.from({ length: 129 }, () => ({ op: 'constant', value: 0 })) }])).toThrow();
  expect(() => parseClientChannels([{ ...row, reads: Array.from({ length: 33 }, (_, n) => `read.${n}`) }])).toThrow();
  expect(() => parseClientChannels([{ ...row, reads: ['same', 'same'] }])).toThrow();
  expect(() => parseClientChannels([{ ...row, channels: [...row.channels, ...row.channels] }])).toThrow();
  expect(() => parseClientChannels([{ ...row, channels: [{ property: 'x', value: 1 }] }])).toThrow();
  expect(() => parseClientChannels([row, row])).toThrow();
  expect(() => parseClientChannels(Array.from({ length: CLIENT_CHANNEL_LIMITS.programs + 1 }, (_, n) => ({ ...row, id: `row.${n}` })))).toThrow();
  expect(() => parseClientChannels(Array.from({ length: 129 }, (_, n) => ({ ...row, id: `row.${n}`, nodes: Array.from({ length: 128 }, () => ({ op: 'constant', value: 0 })) })))).toThrow();
  const properties = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'scaleX', 'scaleY', 'scaleZ', 'value', 'turn', 'visible'];
  expect(() => parseClientChannels(Array.from({ length: 342 }, (_, n) => ({ ...row, id: `row.${n}`, channels: properties.map(property => ({ property, value: 0 })) })))).toThrow();
  for (const property of ['shared.score', 'player.health', 'position', 'spawn', 'event']) {
    expect(() => createClientChannels({ ...row, channels: [{ property, value: 0 }] })).toThrow();
  }
  for (const op of ['writeShared', 'writePlayer', 'loop', 'recurse']) expect(() => createClientChannels({ ...row, nodes: [{ op, id: 1, value: 1 }] })).toThrow();
});

it('copies permitted state observations and exposes no shared or player writer', () => {
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 1 },
    [{ id: 1, name: 'alice', fields: {}, position: [0, 0, 0], frozen: false, interactive: true }], {
      shared: [{ id: 101, name: 'public', type: 'bool', privacy: 'public', default: 0, min: 0, max: 1 }],
      player: [{ id: 202, name: 'owned', type: 'bool', privacy: 'owner', default: 0, min: 0, max: 1 }],
    }, new Map([[1, 'alice']]));
  const before = world.checkpoint(), observed = world.view('alice'), row = new ClientChannels('copy');
  row.output('value', row.binary('add', row.read('public'), row.read('owned')));
  const view = createClientChannels(row.build()), values = [observed.shared['public'], observed.player['owned']].map(value => {
    if (typeof value !== 'number') throw new Error('Missing permitted numeric observation'); return value;
  });
  view.evaluate({ time: 0.0123, delta: 0.0123, values });
  values[0] = 99;
  expect(view.frame.value).toBe(0);
  expect(Reflect.set(view.frame, 'value', 99)).toBe(false);
  expect(Reflect.set(view.frame, 'player.health', 99)).toBe(false);
  expect(Object.keys(view)).toEqual(['reads', 'frame', 'evaluate']);
  expect(world.checkpoint()).toEqual(before);
});

it('detaches authored data and publishes atomically after all finite output calculations pass', () => {
  const row = new ClientChannels('atomic'), time = row.clock('time');
  row.output('x', time); row.output('value', row.binary('div', row.constant(1), row.read('divisor')));
  const source = row.build(), view = createClientChannels(source);
  view.evaluate({ time: 1.25, delta: 0.25, values: [2] });
  source.nodes[0] = { op: 'constant', value: 999 };
  const before = { ...view.frame };
  for (const observation of [{ time: 2, delta: 1, values: [0] }, { time: Infinity, delta: 1, values: [2] },
    { time: 2, delta: -1, values: [2] }, { time: 2, delta: 1, values: [] }, { time: 2, delta: 1, values: [Number.NaN] }]) {
    expect(() => view.evaluate(observation)).toThrow(); expect({ ...view.frame }).toEqual(before);
  }
  view.evaluate({ time: 2.5, delta: 0.25, values: [4] });
  expect(view.frame).toMatchObject({ x: 2.5, value: 0.25 });
});

it('requires explicit trusted ownership and prevents a second data-runtime installation', () => {
  const source = emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Test', revision: 1, seed: 1 });
  expect(() => parseShardfile({ ...source, clientChannels: [program()] })).toThrow('shardfile semantic rules');
  const bound = parseShardfile({ ...source, clientChannels: [program()], runtime: { entry: 'runtime/index.ts', binds: ['clientChannels'] } });
  expect(withoutRuntimeRows(bound).clientChannels).toEqual([]);
  expect(bound.clientChannels).toHaveLength(1);
});

it('emits closed bounded JSON Schema with the defining backward-reference and aggregate checks', () => {
  const roots = formatJsonSchemas(), programSchema = formatJsonSchema(ClientChannelProgramSchema);
  expect(roots['clientChannels.ClientChannels']).toMatchObject(formatJsonSchema(ClientChannelsSchema));
  expect(roots['clientChannels.ClientChannelProgram']).toMatchObject(programSchema);
  expect(roots['clientChannels.ClientChannels']?.maxItems).toBe(512);
  expect(programSchema.additionalProperties).toBe(false);
  expect(programSchema.properties?.['nodes']).toMatchObject({ maxItems: 128 });
  expect(programSchema.properties?.['reads']).toMatchObject({ maxItems: 32 });
  expect(programSchema.properties?.['channels']).toMatchObject({ maxItems: 12 });
  expect(JSON.stringify(roots['clientChannels.ClientChannels'])).toContain('@wildshard/format/clientChannels#');
  expect(JSON.stringify(programSchema)).not.toContain('writeShared');
});
