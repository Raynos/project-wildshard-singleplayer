import { RETURN_PROGRAM } from './fixtures/driftwood-guest-programs';
// @vitest-environment happy-dom
import { expect, onTestFinished, test, vi } from 'vitest';
import { lendDriftwoodReturns } from './fixtures/driftwood-return-modules';
import { Scope } from '../src/engine/shared/app/scope';
import { ProjectedState, ReturnProgram } from '../src/game/shared/population/returnProgram';
import { ReturnGate } from '../src/game/shared/population/respawn';
import { populationProjectionRows } from '../src/shards/driftwood-isle/generators/populationProjection';
import { readNativeTerrain } from '../src/sharddev/bake/terrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { WORLD_DROP } from '../src/shards/driftwood-isle/generators/landscapeRows';
import { islandFoliagePlacements } from '../src/shards/driftwood-isle/generators/islandDressing';
import { DRIFTWOOD_ISLAND_FACTS as island } from './fixtures/driftwood-island-facts';
import { installWorldFixture } from './fixtures/worldSetup';

await installWorldFixture();

const foliage = islandFoliagePlacements();


test('both tiers bake every leaning crown and base with the installed native terrain law', () => {
  const projection = populationProjectionRows(island, RETURN_PROGRAM), heightAt = readNativeTerrain(driftwoodGroundBytes()).heightAt;
  for (const tier of ['phone', 'desktop'] as const) {
    const palms = [...foliage.tiers[tier].palms.specs, ...island.extraPalms], sites = projection.page[tier].perches;
    expect(sites).toHaveLength(palms.length);
    palms.forEach((palm, index) => {
      const base = heightAt(palm.x, palm.z) - WORLD_DROP - .2;
      expect(sites[index]).toEqual({ crown: [palm.x + Math.cos(palm.leanDir) * palm.lean * palm.h, base + palm.h + .5,
        palm.z + Math.sin(palm.leanDir) * palm.lean * palm.h], base: [palm.x, base + .2, palm.z] });
    });
  }
});


test('the admitted return guest retains hidden-corpse gates and samples at ten Hz', () => {
  const rows = populationProjectionRows(island, RETURN_PROGRAM).practice, rule = { delay: .3, away: 5, fade: 'hidden' } as const;
  const scope = lendDriftwoodReturns(new Scope('return.guest')); onTestFinished(() => { scope.dispose(); });
  const guest = ReturnProgram.page(rows.program, scope), sample = vi.spyOn(guest, 'project');
  const law = new ProjectedState({ ...rows.law, parameters: { delay: rule.delay, away: rule.away }, signals: { step: rows.law.signal } }, guest);
  const clock = { dead: 0, fade: -1 }, actions = { none: 0, fade: 1, replace: 2 };
  for (const frame of [
    { alive: true, hidden: false, distance: 20 },
    ...Array.from({ length: 5 }, () => ({ alive: false, hidden: false, distance: 1 })),
    { alive: false, hidden: false, distance: 5 },
    { alive: false, hidden: true, distance: 4.99 },
    { alive: false, hidden: true, distance: 5 },
  ]) {
    const calls = sample.mock.calls.length;
    expect(law.step(.04, { ...frame, alive: Number(frame.alive), hidden: Number(frame.hidden), deadDt: frame.alive ? 0 : .04 }).dt).toBe(0);
    expect(sample).toHaveBeenCalledTimes(calls);
    const next = law.step(.06, { ...frame, alive: Number(frame.alive), hidden: Number(frame.hidden), deadDt: frame.alive ? 0 : .1 });
    expect(sample).toHaveBeenCalledTimes(calls + 1);
    expect(next.values['action']).toBe(actions[ReturnGate.step(clock, rule, .1, frame.alive, frame.distance, frame.hidden)]);
    expect(law.value('dead')).toBe(clock.dead);
  }
  law.reset(); expect(law.value('dead')).toBe(0);
  expect(law.step(.05, { alive: 0, hidden: 1, distance: 99 }).dt).toBe(0);
});
