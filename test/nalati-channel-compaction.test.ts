import { test, expect } from 'vitest';
import * as v from 'valibot';
import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { createClientChannels } from '@wildshard/game/plugin/channels';
import { parseClientChannels } from '@wildshard/format/clientChannels';
import { isJsonData } from '@wildshard/format/json';
import { fixtureBytes } from '@wildshard/engine/test/nativeBytes';
import { compactChannels } from '../src/shards/nalati-grasslands/generators/channelRows';
import { originalSpeciesJson } from './fixtures/nalati-original-species';

function numeric(dag: ClientChannels) {
  return { ...dag.build(), numeric: { group: 'test', outputs: [{ property: 'value', target: 'root', path: ['value'] }] } };
}

test('identical pure expressions share slots without changing recurrence or signed zero', () => {
  const dag = new ClientChannels('compact.test'), previous = dag.local(0), input = dag.read('input');
  const a = dag.binary('add', previous, input), b = dag.binary('add', previous, input);
  const next = dag.binary('mul', a, b); dag.retain(previous, next); dag.output('value', next);
  const row = numeric(dag), compacted = compactChannels([row])[0];
  expect(compacted).toBeDefined(); expect(compacted?.nodes.length).toBe(row.nodes.length - 1);
  const original = createClientChannels(row), candidate = createClientChannels(compacted);
  for (const value of [0, -0, .2, -.5, .8, 0]) {
    const frame = { time: 1, delta: .1, values: [value] };
    original.evaluate(frame); candidate.evaluate(frame);
    expect(candidate.frame).toEqual(original.frame);
  }
  const invalid = new ClientChannels('compact.invalid'); invalid.output('value', invalid.constant(-0));
  expect(isJsonData(compactChannels([numeric(invalid)]))).toBe(false);
});

test('eager invalid arithmetic still refuses without publishing the next local', () => {
  const dag = new ClientChannels('compact.refusal'), local = dag.local(1), input = dag.read('input');
  dag.binary('div', local, input); dag.binary('div', local, input);
  const next = dag.binary('add', local, dag.constant(1)); dag.retain(local, next); dag.output('value', next);
  const row = numeric(dag), original = createClientChannels(row), candidate = createClientChannels(compactChannels([row])[0]);
  for (const lane of [original, candidate]) {
    lane.evaluate({ time: 0, delta: 0, values: [1] });
    expect(lane.frame.value).toBe(2);
    expect(() => lane.evaluate({ time: 0, delta: 0, values: [0] })).toThrow();
    expect(lane.frame.value).toBe(2);
    lane.evaluate({ time: 0, delta: 0, values: [1] });
    expect(lane.frame.value).toBe(3);
  }
});

test('shipping pose and weather DAGs preserve every evaluated output', () => {
  const read = (name: string): unknown => JSON.parse(new TextDecoder().decode(fixtureBytes(new URL(`../src/shards/nalati-grasslands/data/${name}.generated.json`, import.meta.url))));
  const species = v.parse(v.object({ poses: v.record(v.string(), v.object({ programs: v.unknown() })) }), originalSpeciesJson('species.json'));
  const rows = Object.values(species.poses).flatMap(pose => parseClientChannels(pose.programs));
  for (const name of ['goldenKingPose', 'herdChannels', 'weatherChannels', 'peopleChannels']) {
    const source = v.parse(v.object({ programs: v.optional(v.unknown()), clientChannels: v.optional(v.unknown()) }), read(name));
    rows.push(...parseClientChannels(source.programs ?? source.clientChannels));
  }
  for (const row of rows) {
    const original = createClientChannels(row), candidate = createClientChannels(compactChannels([row])[0]);
    for (let step = 0; step < 20; step++) {
      const frame = { time: step * .125, delta: .125, values: row.reads.map((_, i) => .2 + (i + step) % 7 / 10) };
      let refused = false;
      try { original.evaluate(frame); } catch { refused = true; }
      if (refused) expect(() => candidate.evaluate(frame)).toThrow();
      else { candidate.evaluate(frame); expect(candidate.frame).toEqual(original.frame); expect(candidate.geometry).toEqual(original.geometry); expect(candidate.connectors).toEqual(original.connectors); }
    }
  }
});
