// oxlint-disable-next-line import/no-nodejs-modules -- Test the actual packaged physics bytes through the native host.
import { readFile } from 'node:fs/promises';
import { beforeAll, expect, it } from 'vitest';
import { creaturesExample } from '../scripts/docs/authoring/creatures';
import { HeadlessSimulation } from '@wildshard/sdk/headless';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { bindShardfileSim, createShardfileSim } from '../src/game/plugin/simulation';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });

it('loads the public author example with no injected recipes and proves actual goat flight and hawk contact', () => {
  const sim = createShardfileSim(creaturesExample(), new Map(), { rapier });
  try {
    const goat = sim.host.entities.get('goat.0'), hawk = sim.host.entities.get('hawk.0');
    if (goat === undefined || hawk === undefined) throw new Error('Missing actual author roster');
    const start = goat.position.clone(), initialHealth = sim.host.player.health.attributes.health;
    let fleeing = false, dive = false, low = false;
    for (let i = 0; i < 600; i++) {
      sim.host.step();
      fleeing ||= goat.state === 'flee' && goat.desiredSpeed > 3;
      dive ||= hawk.attackPhase >= 0;
      low ||= hawk.position.y - sim.host.player.position.y <= 1.21;
    }
    expect(fleeing).toBe(true); expect(goat.position.distanceTo(start)).toBeGreaterThan(10);
    expect(goat.position.distanceTo(sim.host.player.position)).toBeGreaterThan(15);
    expect(dive).toBe(true); expect(low).toBe(true);
    expect(sim.host.player.health.attributes.health).toBeLessThan(initialHealth);
  } finally { sim.dispose(); }
});

it('restores every data-host observation, herd policy and diver strike clock with an exact real-physics suffix', () => {
  const source = creaturesExample(), sim = createShardfileSim(source, new Map(), { rapier });
  try {
    for (let i = 0; i < 230; i++) sim.host.step({ moveX: 0.2, moveZ: 0, yaw: 0 });
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier }, saved,
      fresh => { bindShardfileSim(fresh, source, new Map(), { rapier, restoring: true }); });
    try {
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let i = 0; i < 600; i++) { sim.host.step(); restored.step(); }
      expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
    } finally { restored.dispose(); }
  } finally { sim.dispose(); }
});

for (const protection of ['cover', 'authorization'] as const) {
  it(`respects actual ${protection} without granting a blocked hawk dive`, () => {
    const sim = createShardfileSim(creaturesExample(), new Map(), { rapier });
    try {
      const initial = sim.host.player.health.attributes.health;
      if (protection === 'cover') {
        const { R, world } = sim.host.physics;
        world.createCollider(R.ColliderDesc.cuboid(30, 0.3, 30).setTranslation(0, 4.5, 0));
      } else sim.host.events.answer('ai.claim', () => false, sim.host.scope);
      for (let i = 0; i < 500; i++) sim.host.step();
      expect(sim.host.player.health.attributes.health).toBe(initial);
      expect(sim.host.entities.get('hawk.0')?.attackPhase).toBe(-1);
    } finally { sim.dispose(); }
  });
}

it('runs and restores the public author worker with no game imports or trusted runtime entry', async () => {
  const source = creaturesExample(), sim = await HeadlessSimulation.create(source, new Map(), undefined, { deadline: 'advisory' });
  try {
    let checkpoint = await sim.step();
    for (let i = 0; i < 120; i++) checkpoint = await sim.step();
    const restored = await HeadlessSimulation.create(source, new Map(), checkpoint.snapshot, { deadline: 'advisory' });
    try {
      for (let i = 0; i < 30; i++) {
        const a = await sim.step(), b = await restored.step();
        expect(b.snapshot).toBe(a.snapshot); expect(b.effects).toEqual(a.effects);
      }
    } finally { await restored.dispose(); }
  } finally { await sim.dispose(); }
});
