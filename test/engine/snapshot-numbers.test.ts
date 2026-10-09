// oxlint-disable-next-line import/no-nodejs-modules -- Real native continuation and pre-extension checkpoint transport.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed pre-extension witnesses are gzipped wires.
import { gunzipSync } from 'node:zlib';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../src/engine/sim/snapshot';
import { SIM_LEVEL, fightCommand } from '../fixtures/sim-level/level';
import { expectSameSimSnapshot } from '../fake/simSnapshot';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it.each([-Infinity, Infinity])('round-trips the exact %s logical sentinel through text and native restore', (sentinel) => {
  const first = createSimHost(SIM_LEVEL, { rapier }); let restored: SimHost | undefined;
  try {
    const creature = first.entities.get('boar:1'); if (creature === undefined) throw new Error('missing real creature');
    creature.mem['deadline'] = sentinel;
    const saved = snapshotSimHost(first);
    // Custom logical values use the same general transport, without a species-specific exception.
    saved.slots.scriptMemory['nested'] = { deadlines: [sentinel, 0, -0] };
    saved.adapters.push({ id: 'fixture.infinity', state: { until: sentinel } });
    const wire = serializeSimSnapshot(saved), decoded = decodeSimSnapshot(wire);
    expect(decoded).toEqual(saved);
    expect(wire).toContain(sentinel === Infinity ? '{"$sim.number":"infinity"}' : '{"$sim.number":"-infinity"}');
    expect(decoded.entities[0]?.state.mem['deadline']).toBe(sentinel);
    // The artificial adapter/slot above prove only the transport. The native restore uses the unchanged real actor.
    saved.adapters.pop(); delete saved.slots.scriptMemory['nested'];
    decoded.adapters.pop(); delete decoded.slots.scriptMemory['nested'];
    restored = restoreSimHost(SIM_LEVEL, { rapier }, decoded);
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < 30; tick++) { first.step(fightCommand(tick)); restored.step(fightCommand(tick)); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    expect(restored.entities.get('boar:1')?.mem['deadline']).toBe(sentinel);
  } finally { restored?.dispose(); first.dispose(); }
});

it('refuses NaN, reserved authored keys, malformed tags and non-finite native coordinates', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const saved = snapshotSimHost(host), animal = saved.entities[0];
    if (animal === undefined) throw new Error('missing snapshot actor');
    animal.state.mem['deadline'] = Number.NaN;
    expect(() => serializeSimSnapshot(saved)).toThrow();
    animal.state.mem['deadline'] = 0;
    const wire = serializeSimSnapshot(saved);
    for (const bad of ['{"$sim.number":"nan"}', '{"$sim.number":"infinity","extra":0}', '{"$sim.number":0}', '1e999']) {
      expect(() => decodeSimSnapshot(wire.replace('"deadline":0', `"deadline":${bad}`))).toThrow();
    }
    saved.slots.scriptMemory['collision'] = { '$sim.number': 'infinity' };
    expect(() => serializeSimSnapshot(saved)).toThrow('reserved number tag');
    delete saved.slots.scriptMemory['collision'];
    saved.player.position[0] = Infinity;
    expect(() => serializeSimSnapshot(saved)).toThrow();
  } finally { host.dispose(); }
});

const Checkpoint = v.object({ snapshot: v.string() });
const rows = [
  ['far-reach', 'step'], ['far-reach', 'gale'], ['far-reach', 'storm'],
  ['nine-dragon-stack', 'ride'], ['nine-dragon-stack', 'crossing'],
  ['pine-hollow', 'ridge'], ['pine-hollow', 'night'], ['pine-hollow', 'king'], ['pine-hollow', 'dam'], ['pine-hollow', 'fallen'],
] as const;

it.each(rows)('keeps the pre-extension %s / %s finite checkpoint wire byte-identical', (slug, name) => {
  const input: unknown = JSON.parse(gunzipSync(readFileSync(`test/proof/${slug}/checkpoints/${name}.snap.gz`)).toString('utf8'));
  const wire = v.parse(Checkpoint, input).snapshot;
  const basis = slug === 'pine-hollow' ? new Uint8Array(gunzipSync(readFileSync('test/proof/pine-hollow/checkpoints/basis.snap.gz'))) : undefined;
  expect(serializeSimSnapshot(decodeSimSnapshot(wire, basis), basis)).toBe(wire);
}, 20_000); // One codec round trip of each already-committed native checkpoint; no gameplay is replayed here.
