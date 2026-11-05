// oxlint-disable-next-line import/no-nodejs-modules -- Real Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { NetClient } from '../src/engine/client/net/client';
import { NetRoom } from '../src/engine/server/net/room';
import { SimNetWorld } from '../src/engine/server/net/simWorld';
import { createSimHost, type SimHost } from '../src/engine/server/sim';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { directLoopback } from '../src/engine/test/netLoopback';
import { netNeighbourRegion } from '../src/game/client/grid/neighbourRows';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// E6 WORLD: each world view's port, fed off the wire instead of the page's sim, shows what the server's sim holds.
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

/** A real room over the direct loopback. */
function wired(host: SimHost): { client: NetClient; run: (ticks: number) => void } {
  const link = directLoopback(), client = new NetClient(link.client), room = new NetRoom({ world: new SimNetWorld(host), step: () => { host.step(); } });
  room.join(link.server); client.hello(); link.pump(); room.open(); link.pump();
  return { client, run: ticks => { for (let tick = 0; tick < ticks; tick++) { room.tick(); link.pump(); } } };
}

test('a neighbour creature reads the same off its row as off the sim', () => {
  const host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const { client, run } = wired(host), { position } = [...host.players.values()][0] ?? { position: null }, [id, sim] = [...host.entities][0] ?? [];
    if (id === undefined || sim === undefined || position === null) throw new Error('No creature on the level');
    sim.harnessHold = true; sim.position.set(position.x + 10, position.y, position.z);
    run(40);
    const shown = netNeighbourRegion(client, () => client.latest?.tick ?? 0).host.entities.get(id);
    expect(shown?.alive).toBe(sim.alive); expect(shown?.state).toBe(sim.state); expect(shown?.scale).toBeCloseTo(sim.scale);
    expect(shown?.position.x).toBeCloseTo(sim.position.x, 1); expect(shown?.position.z).toBeCloseTo(sim.position.z, 1);
    expect(netNeighbourRegion(client, () => 0).host.entities.get('nobody')).toBeUndefined();
  } finally { host.dispose(); }
});
