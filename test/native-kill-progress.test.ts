// oxlint-disable-next-line import/no-nodejs-modules -- The native behaviour fixture uses the actual shipped physics binary.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { installDriftwoodKills, KILLS_STEP, SAILOR_DEAD_FLAG } from '../src/shards/driftwood-isle/runtime/kills';
import { DRIFTWOOD_FEATS } from '../src/shards/driftwood-isle/data/questInventory';

test('native kill counters resume old progress, keep flag/emission order and refuse malformed saves', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const bodies: { kind: string; actor: ReturnType<typeof host.spawn> }[] = [], facts: string[] = [];
  try {
    const kills = installDriftwoodKills(host, DRIFTWOOD_FEATS, () => bodies, (name, identity) => {
      if (name === 'driftwood.sailor') expect(host.flags.has(SAILOR_DEAD_FLAG)).toBe(true);
      facts.push(identity);
    });
    const saved = host.adapters.get(KILLS_STEP); if (saved === undefined) throw new Error('Missing existing kill continuation');
    saved.restore({ sailor: 0, crab10: 4, monkey6: 0 });
    expect(kills.count('crab10')).toBe(4);
    expect(kills.count('missing')).toBe(0); expect(kills.count('__proto__')).toBe(0); expect(kills.count('toString')).toBe(0);
    const recipe = SIM_LEVEL.entities[0]; if (recipe === undefined) throw new Error('Missing real body recipe');
    const defeat = (kind: string, id: string): void => {
      const actor = host.spawn({ ...recipe, id, spec: { ...recipe.spec, kind, hp: 1 }, at: { x: 8, y: 0, z: 8 } });
      bodies.push({ kind, actor });
      host.combat.hit({ source: 'env', sourceTags: ['cover.checked'], target: actor.combatActor(), amount: 100,
        point: actor.position.clone(), dir: new Vector3() });
      host.step();
    };
    defeat('sailor', 'sailor'); expect(facts).toContain('sailor:1');
    defeat('crab', 'crab'); expect(kills.count('crab10')).toBeGreaterThan(4); expect(facts).toContain('crab10:5');
    saved.restore({ sailor: 1, crab10: 10, monkey6: 0 });
    const emitted = facts.length; defeat('crab', 'saturated-crab'); expect(facts.length).toBe(emitted);
    const progress = kills.count('crab10');
    expect(() => saved.restore({ sailor: 1, crab10: Infinity, monkey6: 0 })).toThrow();
    expect(kills.count('crab10')).toBe(progress);
    expect(() => saved.restore({ sailor: 1, crab10: 10, monkey6: 0, extra: 1 })).toThrow();
    host.step(); expect([host.player.position.x, host.player.position.y, host.player.position.z].every(Number.isFinite)).toBe(true);
  } finally { host.dispose(); }
});
