// oxlint-disable-next-line import/no-nodejs-modules -- The portal oracle loads the shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { createSimHost, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { parseDirectorStages } from '../../../src/format/directorStages';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { prepareHeadlessRuntime, addNinePieces } from '../../../src/shards/nine-dragon-stack/runtime/headless';
import { installNinePortals, PORTAL_STEP } from '../../../src/shards/nine-dragon-stack/runtime/portals';
import { installHostRide } from '../../../src/shards/nine-dragon-stack/runtime/portals/hostRide';
import { portalRide, playerRider } from '../../../src/shards/nine-dragon-stack/world/portalRide';
import { rideFeats } from '../../../src/shards/nine-dragon-stack/world/feats';

let rapier: Rapier, level: SimLevel;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  level = (await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier })).level;
});
const north = () => {
  const row = source.entryways.find(entry => entry.edge === 'north')?.portal;
  if (row === undefined) throw new Error('Missing north portal');
  return row.road.at;
};
const native = (at = north()): SimHost => {
  const [x, y, z] = at;
  const host = createSimHost({ ...level, player: { ...level.player, at: { x, y: y + 0.1, z } } }, { ground: false, rapier });
  addNinePieces(host.physics);
  return host;
};
const continuation = (host: SimHost): string => {
  const state = snapshotSimHost(host).adapters.find(row => row.id === PORTAL_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing portal continuation');
  return state;
};

it('matches the original page-owned native factory and restores the held/transfer suffix exactly', () => {
  const before = native(), after = native(), oldFacts: string[] = [], newFacts: string[] = [], copyFacts: string[] = [];
  let copy: SimHost | undefined;
  try {
    const old = installHostRide(before, PORTAL_STEP, body => portalRide(playerRider(body, () => before.physics), () => { /* native */ }),
      ride => rideFeats(ride.step, ride.rides, name => { oldFacts.push(name); }));
    const current = installNinePortals(after, source, name => { newFacts.push(name); });
    for (let tick = 0; tick < 400; tick++) {
      before.step(); after.step(); copy?.step();
      expect(continuation(after)).toBe(continuation(before));
      expect(current.snapshot()).toEqual(old.snapshot());
      expect(after.player.position).toEqual(before.player.position);
      expect(newFacts).toEqual(oldFacts);
      if (copy !== undefined) expect(continuation(copy)).toBe(continuation(before));
      if (tick === 4) {
        expect(current.busy()).toBe(true); expect(current.rides()).toEqual([]);
        const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(after)));
        const ports = { ground: false, rapier };
        copy = restoreSimHost({ ...level, player: { ...level.player, at: { x: north()[0], y: north()[1] + 0.1, z: north()[2] } } }, ports, saved,
          fresh => { installNinePortals(fresh, source, name => { copyFacts.push(name); }); });
        expect(continuation(copy)).toBe(continuation(after));
      }
    }
    expect(current.rides()).toHaveLength(1); expect(current.refused()).toEqual([]);
    expect(newFacts).toEqual(['nine-dragon-stack.lantern-square']); expect(copyFacts).toEqual(newFacts);
    expect(after.player.position.y).toBeGreaterThan(124);
  } finally { before.dispose(); after.dispose(); copy?.dispose(); }
});

it('selects the supplied admitted portal node instead of the global placement', () => {
  const changed = structuredClone(source), row = changed.entryways.find(entry => entry.edge === 'north');
  if (row?.portal === undefined) throw new Error('Missing declared north');
  row.portal.road.at[2] += 1;
  const normalHost = native(row.portal.road.at), changedHost = native(row.portal.road.at);
  try {
    const normal = installNinePortals(normalHost, source), actual = installNinePortals(changedHost, changed);
    normalHost.step(); changedHost.step();
    expect(normal.busy()).toBe(false); expect(actual.busy()).toBe(true);
    expect(actual.snapshot().from).toBe(row.portal.road.id);
  } finally { normalHost.dispose(); changedHost.dispose(); }
});

it('uses the admitted director transition and refuses a missing root before registering a step', () => {
  const data = source.directors?.find(row => row.id === 'nine.portal-ride');
  if (data === undefined) throw new Error('Missing portal director');
  const changed = structuredClone(data), held = changed.stages.find(stage => stage.id === 'held');
  if (typeof held?.next === 'string' || held?.next?.[0] === undefined) throw new Error('Missing held transition');
  held.next[0].when = 'false';
  const stages = parseDirectorStages(changed), host = native(), empty = native();
  const install = vi.spyOn(empty, 'onStep');
  try {
    const ride = installNinePortals(host, { ...source, directors: [stages] });
    for (let tick = 0; tick < 100; tick++) host.step();
    expect(ride.busy()).toBe(true); expect(ride.rides()).toEqual([]);
    expect(() => installNinePortals(empty, { ...source, directors: [] })).toThrow('Missing Nine portal director');
    expect(install).not.toHaveBeenCalled();
  } finally { host.dispose(); empty.dispose(); }
});
