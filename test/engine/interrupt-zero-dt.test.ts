import { afterAll, afterEach, expect, it } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '../../src/game/shard/registry';
import { manager } from '../fake/manager';
import { speciesDef } from '../../src/engine/entities/species/registry';
import { declaredCreatureRows } from '../../src/shards/driftwood-isle/runtime/brains';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const originalChunk = getActiveChunk().slug;
const crabDef = speciesDef('crab'), legacy = { think: crabDef.think, act: crabDef.act };
afterEach(() => { setActiveChunk(originalChunk); Object.assign(crabDef, legacy); });

it('a second wake in one frame decides the shipping crab policy with a zero step instead of faulting (Driftwood: "Invalid skirmisher step")', () => {
  // the shipping crab row: the data-selected skirmisher policy (runtime/brains.ts), which used to refuse a zero step
  const row = declaredCreatureRows().find(entry => entry.kind === 'crab'); if (row === undefined) throw new Error('missing declared crab');
  Object.assign(crabDef, { think: row.think, act: row.act });
  setActiveChunk('driftwood-isle'); const f = manager();
  const crab = f.manager.spawn('crab', 0, 0, 0, 'small'), seen = new Set<string>();
  f.player.position.set(0, 0, 5);
  for (let i = 0; i < 120; i++) { f.advance(1); seen.add(String(crab.mem['st'])); }
  // the crab thought this frame already (a sidestepping crab thinks every frame); a swing and a dodge both wake it now
  expect(() => { f.manager.interrupt(crab, 'target.attack'); f.manager.interrupt(crab, 'target.dodge'); }).not.toThrow();
  f.advance(30);
  expect(seen.size).toBeGreaterThan(1);
});
