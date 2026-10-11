import { Scene } from 'three';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import { Entry, Portal, SocketLift } from '../src/sdk/entries';
import { readScene, type SceneDescription } from '../src/sdk/scene';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { EntrywaysSchema } from '../src/format/entryways';
import { parsePortalLink } from '../src/format/portalLink';
import { parseSocketLift } from '../src/format/socketLift';
import { templateProps } from '../src/shards/_template/generators/templatePropsSource';
import { pastelProps } from '../src/shards/pastel-plain/generators/props';

const portal = parsePortalLink({ road: { id: 'road', at: [0, 0, 240], floor: 'road-floor' }, destination: { id: 'arrival', at: [0, 12, 20], floor: 'arrival-floor' }, exit: { id: 'exit', at: [0, 12, 24], floor: 'exit-floor' }, links: [{ from: 'road', to: 'arrival' }, { from: 'exit', to: 'road' }], route: [[0, 12, 20], [0, 12, 24]] });
const lift = parseSocketLift({ mover: 'lift', gate: 'lift-gate', roadStop: [240, 0, 0], topStop: [240, 12, 0], route: [[240, 12, 0], [220, 12, 0]], rideTicks: 120, approach: { colliders: ['approach-floor'], route: [[238, 0, 0], [240, 0, 0]] } });

for (const [name, fixture] of [['Template 1', templateProps], ['Pastel Plain', pastelProps]] as const) {
  it(`${name}: portal and socket-lift author objects emit the existing entry bytes through persisted scene JSON`, () => {
    const authored = fixture(20), scene = new Scene(); scene.add(authored.source.static, new Portal('north', portal), new SocketLift('east', lift), new Entry('south'), new Entry('west'));
    try {
      // oxlint-disable-next-line unicorn/prefer-structured-clone -- Persisted JSON, rather than an object clone, is the bake-reader gate.
      const persisted = JSON.parse(JSON.stringify(readScene(scene))) as SceneDescription;
      const before = v.parse(EntrywaysSchema, [{ edge: 'north', at: [0, 0, 250], width: 8, kind: 'portalLink', portal }, { edge: 'east', at: [250, 0, 0], width: 8, kind: 'socketLift', lift }, { edge: 'south', at: [0, 0, -250], width: 8 }, { edge: 'west', at: [-250, 0, 0], width: 8 }]);
      const after = v.parse(EntrywaysSchema, persisted.entries);
      expect(after).toStrictEqual(before);
      expect(new TextEncoder().encode(encodeCanonicalJson(after))).toStrictEqual(new TextEncoder().encode(encodeCanonicalJson(before)));
      expect(readScene(scene.clone()).entries).toStrictEqual(after);
    } finally { authored.dispose(); }
  });
}

it('clones routes independently and refuses missing bindings, malformed routes and moved sockets', () => {
  const p = new Portal('north', portal), cloned = p.clone();
  if (cloned.portal === undefined) throw new Error('Missing cloned link');
  cloned.portal.route[0] = [1, 12, 20]; expect(p.toEntryData().portal).toStrictEqual(portal); expect(() => cloned.toEntryData()).toThrow();
  expect(() => new Portal().toEntryData()).toThrow(/requires/u); expect(() => new SocketLift().toEntryData()).toThrow(/requires/u);
  expect(() => new Entry('north', 'portalLink').toEntryData()).toThrow(/matching/u);
  const ride = new SocketLift('east', lift); ride.position.y = 1; expect(() => ride.toEntryData()).toThrow(/midpoint/u);
  const scene = new Scene(); scene.add(p, new Portal('north', portal)); expect(() => readScene(scene)).toThrow(/Duplicate entry/u);
});
