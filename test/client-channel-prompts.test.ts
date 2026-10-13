import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ClientChannels } from '../src/sdk/clientChannels';
import { createClientChannelPrompt, bindClientChannels } from '../src/game/plugin/ui';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { SKY_LIFT_PROMPTS } from '../src/shards/far-reach/data/liftPrompts';
import entries from '../src/shards/far-reach/data/islets.generated.json';
import { ISLET } from '../src/shards/far-reach/data/isletDesign';
import { APOTHEM } from '../src/shards/far-reach/data/layout';
import { SIGNAL_BUCKET_CHANNELS } from '../src/shards/sunscar-dunes/data/bucketMotion';

it('projects all original lift prompts exactly at both stops, mid-travel and the strict distance boundary', () => {
  const actions: unknown[] = [], calls = bindClientChannels(SKY_LIFT_PROMPTS, { targets: new Map() });
  calls.bindPrompts(action => () => { actions.push(action); });
  expect(calls.interactables).toHaveLength(12);
  for (const [index, entry] of entries.entries.entries()) {
    const h = new Vector3(entry.dock.x - entry.rest.x, 0, entry.dock.z - entry.rest.z).normalize();
    const rim = new Vector3(entry.dock.x, entry.gate.y + 1, entry.dock.z).addScaledVector(h, ISLET.islet.r * APOTHEM + 1.5);
    const ride = calls.interactables[index * 3], down = calls.interactables[index * 3 + 1], up = calls.interactables[index * 3 + 2];
    if (ride === undefined || down === undefined || up === undefined) throw new Error('Missing authored lift prompts');
    expect([ride.radius, down.radius, up.radius]).toEqual([ISLET.islet.r * APOTHEM + 0.05, 3, 3]);
    for (const p of [entry.rest, entry.dock, { x: entry.rest.x, y: (entry.rest.y + entry.dock.y) / 2, z: entry.rest.z },
      ...[0.000999999999, 0.001, 0.001000000001].map(delta => ({ x: entry.rest.x + delta, y: entry.rest.y, z: entry.rest.z }))]) {
      calls.updateMovers(id => ({ position: id === `far.islet.${entry.edge}` ? p : entries.entries[0]?.rest ?? p, euler: { x: 0, y: 0, z: 0 }, enabled: true }));
      const atRoad = Math.hypot(p.x - entry.rest.x, p.y - entry.rest.y, p.z - entry.rest.z) < 0.001;
      const atTop = Math.hypot(p.x - entry.dock.x, p.y - entry.dock.y, p.z - entry.dock.z) < 0.001;
      expect(ride.position.toArray()).toEqual([p.x, atRoad || atTop ? p.y + 1 : -1e5, p.z]);
      expect(down.position.toArray()).toEqual([entry.landing.x, atTop ? 1 : -1e5, entry.landing.z]);
      expect(up.position.toArray()).toEqual([rim.x, atRoad ? rim.y : -1e5, rim.z]);
    }
  }
  expect(actions).toEqual([]);
  for (const spot of calls.interactables) spot.onInteract();
  expect(actions).toEqual(SKY_LIFT_PROMPTS.map(row => row.prompt?.action));
});

it('binds Signal well input once, copies its original fixed position and never grants oil from evaluation', () => {
  const before = { oil: false }, lane = createClientChannelPrompt(SIGNAL_BUCKET_CHANNELS[1], action => {
    if (action.kind !== 'named' || action.name !== 'sunscar.well.take') throw new Error('Unbound input');
    return () => { before.oil = true; };
  });
  const copied = [12.75, 3.125, -87];
  lane.evaluate({ time: 0, delta: 0, values: copied }); copied[0] = 999;
  expect(lane.spot.position.toArray()).toEqual([12.75, 3.125, -87]);
  expect(lane.spot.radius).toBe(2.6); expect(before.oil).toBe(false);
  lane.spot.onInteract(); expect(before.oil).toBe(true);
});

it('refuses malformed positions, unbound intents, duplicate prompt identities and excessive rosters before input', () => {
  const row = new ClientChannels('prompt.fixture');
  for (const axis of ['x', 'y', 'z'] as const) row.output(axis, row.constant(0));
  row.prompt({ id: 'fixture.prompt', label: 'Use', radius: 2, at: [0, -1e5, 0], action: { kind: 'named', name: 'allowed' } });
  const source = row.build();
  expect(() => createClientChannelPrompt(source, () => { throw new Error('Unbound intent'); })).toThrow('Unbound intent');
  expect(() => parseClientChannels([{ ...source, channels: [{ property: 'x', value: 0 }] }])).toThrow();
  expect(() => parseClientChannels([source, { ...source, id: 'different' }])).toThrow();
  expect(() => parseClientChannels(Array.from({ length: 65 }, (_, i) => ({ ...source, id: `prompt.${i}`, prompt: { ...source.prompt, id: `spot.${i}` } })))).toThrow();
  expect(() => parseClientChannels([{ ...source, prompt: { ...source.prompt, action: { kind: 'writePlayer', value: 1 } } }])).toThrow();
  const unsafe = new ClientChannels('cycle'); const a = unsafe.constant(1);
  unsafe.output('value', unsafe.hypot3(a, a, 9)); expect(() => unsafe.build()).toThrow();
});
