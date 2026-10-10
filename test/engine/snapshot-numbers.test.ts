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
import { nativeCompatibility } from '../proof/compatibility/native';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it.each([-Infinity, Infinity])('round-trips the exact %s logical sentinel through text and native restore', (sentinel) => {
  const first = createSimHost(SIM_LEVEL, { rapier }); let restored: SimHost | undefined;
  try {
    const creature = first.entities.get('boar:1'); if (creature === undefined) throw new Error('missing real creature');
    creature.mem['deadline'] = sentinel;
    const install = (host: SimHost, until: number) => {
      const memory = { until };
      host.onStep('fixture.infinity', () => undefined, { snapshot: () => ({ ...memory }), restore: value => { memory.until = v.parse(v.strictObject({ until: v.number() }), value).until; } });
      return memory;
    };
    install(first, sentinel);
    first.slots.scriptMemory['nested'] = { deadlines: [sentinel, 0, -0] };
    const saved = snapshotSimHost(first);
    const wire = serializeSimSnapshot(saved), decoded = decodeSimSnapshot(wire);
    expect(decoded).toEqual(saved);
    expect(wire).toContain(sentinel === Infinity ? '{"$sim.number":"infinity"}' : '{"$sim.number":"-infinity"}');
    expect(decoded.entities[0]?.state.mem['deadline']).toBe(sentinel);
    let restoredMemory: { until: number } | undefined;
    restored = restoreSimHost(SIM_LEVEL, { rapier }, decoded, host => { restoredMemory = install(host, 0); });
    expect(restoredMemory?.until).toBe(sentinel);
    expect(restored.slots.scriptMemory['nested']).toEqual({ deadlines: [sentinel, 0, -0] });
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let tick = 0; tick < 30; tick++) { first.step(fightCommand(tick)); restored.step(fightCommand(tick)); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    expect(restored.entities.get('boar:1')?.mem['deadline']).toBe(sentinel);
  } finally { restored?.dispose(); first.dispose(); }
});

it('refuses NaN, reserved authored keys, malformed tags and non-finite native coordinates', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    host.slots.scriptGlobals['deadline'] = Number.NaN;
    expect(() => snapshotSimHost(host)).toThrow('Simulation slots refuse NaN');
    delete host.slots.scriptGlobals['deadline'];
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
const checkpointDirectories = new Map<string, string>();
function checkpointDirectory(slug: string): string {
  const cached = checkpointDirectories.get(slug);
  if (cached !== undefined) return cached;
  const result = nativeCompatibility(slug, 'checkpoint-directory');
  if (result.status !== 0) throw new Error(`Native checkpoint generation failed: ${result.stderr}`);
  const { directory } = v.parse(v.object({ directory: v.string() }), JSON.parse(result.stdout));
  checkpointDirectories.set(slug, directory); return directory;
}

it.each(rows)('keeps the pre-extension %s / %s finite checkpoint wire byte-identical', (slug, name) => {
  const directory = checkpointDirectory(slug);
  const input: unknown = JSON.parse(gunzipSync(readFileSync(`${directory}/${name}.snap.gz`)).toString('utf8'));
  const wire = v.parse(Checkpoint, input).snapshot;
  const basis = slug === 'pine-hollow' ? new Uint8Array(gunzipSync(readFileSync(`${directory}/basis.snap.gz`))) : undefined;
  expect(serializeSimSnapshot(decodeSimSnapshot(wire, basis), basis)).toBe(wire);
}, 20_000); // CI prepares caches before Vitest; this test checks the real generated wire's codec round trip.
