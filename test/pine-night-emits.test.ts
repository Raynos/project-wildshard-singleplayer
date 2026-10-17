import { expect, test } from 'vitest';
import { PopulationWaveDirector, preparePopulationModule, type PopulationActor } from '../src/shards/pine-hollow/quest/waves';
import type { PopulationWaveSpec } from '../src/shards/pine-hollow/quest/waveRows';
import nightDeclaration from '../src/shards/pine-hollow/data/nightDirector.json' with { type: 'json' };
import nightModule from '../src/shards/pine-hollow/behaviour/night.generated.json' with { type: 'json' };
import nightRows from '../src/shards/pine-hollow/data/nightPopulation.generated.json' with { type: 'json' };
import tuning from '../src/shards/pine-hollow/data/populationWaves.json' with { type: 'json' };

interface Actor extends PopulationActor { readonly id: string }
const spec: PopulationWaveSpec = {
  max: 3, region: { x: 0, z: 0, ax: 100, az: 100 }, exclude: { x: 200, z: 200, blend: 1 },
  face: { x: 5, z: 5 }, mill: { x: 0, z: 0 }, water: 0, roamKinds: ['thrall'],
  race: [{ kind: 'thrall', x: 10, z: 0 }],
};

test('night emits retain population effects, quiet save adoption and completion-only errand payout', async () => {
  const create = await preparePopulationModule(nightDeclaration, nightModule, 357), actors: Actor[] = [], effects: string[] = [];
  let night = 1, errand = true, draws = 0;
  const ports = {
    night: () => night, errand: () => errand,
    onErrandDone: () => { effects.push('done'); errand = false; },
    stream: { next: () => { draws++; return 0.25; } }, ground: { heightAt: () => 10 },
    spawn: (_kind: string, x: number, z: number, _yaw: number): Actor => {
      const id = String(actors.length);
      const actor: Actor = { id, position: { x, y: 10, z }, alive: true, hp: 10, maxHp: 10, lookWeight: 1,
        setMotion: (_heading, speed) => { effects.push(`move:${id}:${String(speed)}`); } };
      actors.push(actor); effects.push(`spawn:${id}`); return actor;
    },
    shot: (name: string, actor: Actor) => { effects.push(`${name}:${actor.id}`); },
    own: (actor: Actor) => { effects.push(`own:${actor.id}`); },
    release: (actor: Actor) => { effects.push(`release:${actor.id}`); },
    retire: (actor: Actor) => { effects.push(`retire:${actor.id}`); },
    burst: (actor: Actor) => { effects.push(`burst:${actor.id}`); },
  };
  const brain = new PopulationWaveDirector(create(), ports, spec, nightRows.stages, tuning), player = { x: 0, y: 10, z: 0 };
  brain.force(player);
  expect(brain.count).toBe(4); expect(draws).toBe(6);
  brain.advance(0.25, player);
  expect(effects.slice(-3)).toEqual(['move:3:0', 'release:3', 'thrall_groan:3']);
  const saved = brain.snapshot(actor => actor.id), before = [...effects];
  const adopted = new PopulationWaveDirector(create(), ports, spec, nightRows.stages, tuning);
  const restore = adopted.prepareRestore(saved, id => actors.find(actor => actor.id === id) ?? null);
  expect(effects).toEqual(before); restore();
  expect(effects).toEqual(before); expect(adopted.snapshot(actor => actor.id)).toEqual(saved);
  night = 0;
  adopted.advance(0.25, player);
  expect(effects.slice(-6)).toEqual(['own:0', 'thrall_move:0', 'own:1', 'thrall_move:1', 'own:2', 'thrall_move:2']);
  for (let i = 0; i < 4; i++) adopted.advance(1, player);
  expect(adopted.count).toBe(1);
  expect(effects.filter(effect => effect.startsWith('burst:'))).toEqual(['burst:0', 'burst:1', 'burst:2']);
  expect(effects).not.toContain('done');
  const racer = actors[3]; if (racer === undefined) throw new Error('Missing spawned racer');
  racer.alive = false;
  adopted.advance(1, player); adopted.advance(1, player);
  expect(effects.filter(effect => effect === 'done')).toHaveLength(1);
  expect(adopted.count).toBe(0); expect(draws).toBe(6);
});
