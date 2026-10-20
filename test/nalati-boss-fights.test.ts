// @vitest-environment happy-dom
import { app } from '../src/engine/app/runtime';
import type { ShardContext } from '../src/game/plugin/context';
import type { ShardRuntime, ShardPlayHost } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import type { HUD } from '../src/engine/ui/HUD';
import { parseRuntimeSpawns } from '../src/format/runtimeSpawns';
import { arenaRoomFight } from '../src/game/boss/arenaRoom';
import { NALATI_RUNTIME_SPAWNS } from '../src/shards/nalati-grasslands/generators/spawns';
import { expect, test } from 'vitest';
import { MeshBasicMaterial, Vector3 } from 'three';
import { BossBrain, type BossScript, type BossDefinition } from '../src/engine/ai/BossBrain';
import { silentBossPresentation } from '../src/engine/ai/phases';
import { overrideTerrain } from '../src/engine/world/Heightfield';
import { Scope } from '../src/engine/app/scope';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { StormTitanFight, prepareStormTitan } from '../src/shards/nalati-grasslands/combat/stormTitan';
import { prepareKurganRows } from '../src/shards/nalati-grasslands/combat/goldenKing';
import { bossArena } from './fake/bossArena';
import type { TitanRiders } from '../src/shards/nalati-grasslands/combat/bossBindings';
import type { NalatiWeather } from '../src/shards/nalati-grasslands/world/installWeather';
import fireView from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import titan from '../src/shards/nalati-grasslands/data/stormTitanFight.generated.json' with { type: 'json' };
import geometry from '../src/shards/nalati-grasslands/data/stormTitanGeometry.generated.json' with { type: 'json' };
import king from '../src/shards/nalati-grasslands/data/goldenKing.generated.json' with { type: 'json' };
import layout from '../src/shards/nalati-grasslands/data/kurganLayout.generated.json' with { type: 'json' };
import world from '../src/shards/nalati-grasslands/boot/layout.generated.json' with { type: 'json' };
import type { Animal } from '../src/engine/entities/AnimalView';
import { manager } from './fake/manager';
import { legacyDouble } from './fake/FakeGame';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import { mockCanvas } from './fake/weaponParity';

function encounter(def: Omit<BossDefinition, 'reward'>, script: BossScript, position: Vector3) {
  let rewards = 0;
  const saved = { defeated: false, rewardTaken: false, kills: 0 };
  const brain = new BossBrain({ ...def, reward: {} }, script, {
    player: { position }, lockInput: () => undefined, skipHeld: () => false,
    respawn: point => { position.copy(point); }, faceToward: () => undefined,
    spawnReward: () => { rewards++; }, persist: value => { Object.assign(saved, value); },
  }, silentBossPresentation(), saved);
  const trace: string[] = [];
  return { brain, saved, trace, get rewards() { return rewards; }, step: (dt: number, t: number) => {
    brain.update(dt, t); const state = `${brain.state}:${brain.phase}`; if (trace.at(-1) !== state) trace.push(state);
  } };
}

test('Golden King runs all phases, clears the real adds and reaches its single reward end state headlessly', async () => {
  const restore = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const f = manager(), dungeon = bossArena().build(true);
  Reflect.set(f.player, 'dash', () => undefined);
  f.player.position.set(layout.DUNGEON.x, layout.DUNGEON.y, layout.DUNGEON.z + 5);
  await prepareKurganRows({ json: <T>() => Promise.resolve(structuredClone<unknown>({ king, programs }) as T) });
  const runtime = legacyDouble<ShardRuntime>({ world: legacyDouble<ShardWorld>({ player: f.player }),
    play: legacyDouble<ShardPlayHost>({ animals: f.manager, hud: legacyDouble<HUD>({ killFeed: () => undefined }) }) });
  const context = legacyDouble<ShardContext>({ app, game: legacyDouble<ShardContext['game']>({ runtime }),
    product: legacyDouble<ShardContext['product']>({ shardfile: legacyDouble<ShardContext['product']['shardfile']>({
      runtime: { entry: 'runtime/main.ts', binds: ['spawns'], spawns: parseRuntimeSpawns(NALATI_RUNTIME_SPAWNS) },
    }) }) });
  const fight = arenaRoomFight(context, dungeon, king.page);
  const e = encounter(king.encounter, fight.script, f.player.position), direction = new Vector3(0, 0, -1);
  try {
    e.brain.arm();
    for (let frame = 0; frame < 12000 && e.brain.state !== 'victory'; frame++) {
      const dt = 1 / 30, t = frame * dt; e.step(dt, t); f.manager.update(dt, t, f.player.position);
      if (frame % 15 === 0 && e.brain.state === 'fight') {
        for (const add of fight.phased.adds()) if (add.alive) add.applyDamage(1000, add.position, direction);
        const body = fight.body(); if (body !== null && !fight.script.shielded) body.applyDamage(90, body.headWorld(new Vector3()), direction);
      }
    }
    expect(e.brain.state).toBe('victory'); expect(e.trace).toEqual(['intro:0','fight:0','beat:1','fight:1','beat:2','fight:2','victory:2']);
    expect(e.saved).toEqual({ defeated: true, rewardTaken: false, kills: 1 }); expect(e.rewards).toBe(1);
    expect(fight.body()?.alive).toBe(false); expect(fight.phased.adds().filter(a => a.alive)).toHaveLength(0);
  } finally { restore(); }
});

test('Storm Titan runs the three mounted phases, exposes the heart and reaches victory headlessly', async () => {
  mockCanvas();
  const restore = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }), scope = new Scope('titan-headless');
  const f = manager(), riders: Animal[] = [], materials = new Map(['nalati-titan-cloud','nalati-titan-flame','nalati-titan-smoke'].map(id => [id, new MeshBasicMaterial()]));
  lendLooks(scope, { materials, setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('No mapped materials in this fight'); } });
  const gr = legacyDouble<TitanRiders>({ spawnRider: ({ x, z }: { x: number; z: number }) => { const a = f.manager.spawn('ghost-rider', x, z, 0, 'rider'); riders.push(a); return a; }, dissolve: (a: Animal) => { a.hidden = true; } });
  await prepareStormTitan({ json: <T>(name: string) => Promise.resolve(structuredClone<unknown>(name.endsWith('titan-fight.json') ? { ...titan, arenaFire: fireView, programs } : geometry) as T) });
  const weather = legacyDouble<NalatiWeather>({ weather: legacyDouble<NalatiWeather['weather']>({ flash: 0, raise: () => undefined }) });
  const game = Object.assign(f.game.asGame(), { levelScope: scope });
  const fight = new StormTitanFight({ game, player: f.player, weather, tieSpot: null }, {
    player: f.player, hurt: () => undefined, throwRider: () => undefined, mounted: () => true, horseSteed: () => undefined,
    feed: () => undefined, toast: () => undefined, riders: () => gr, animals: () => f.manager,
  });
  f.player.position.set(world.CAIRN.x, 0, world.CAIRN.z + titan.TITAN_PLACE.centreZ); fight.tied = true;
  const e = encounter(titan.TITAN_ENCOUNTER, fight, f.player.position), direction = new Vector3(0, 0, -1);
  try {
    e.brain.arm();
    for (let frame = 0; frame < 12000 && e.brain.state !== 'victory'; frame++) {
      const dt = 1 / 30, t = frame * dt; e.step(dt, t);
      if (frame % 15 === 0 && e.brain.state === 'fight') {
        for (const rider of riders) if (rider.alive) rider.applyDamage(1000, rider.position, direction);
        const target = fight.lockTarget();
        if (target !== null && fight.heartOpen) {
          const hit = fight.target(target.position.clone().add(new Vector3(0, 0, 30)), direction, 100, null);
          expect(hit).not.toBeNull(); hit?.animal.applyDamage(90, hit.point, direction);
        }
      }
    }
    expect(e.brain.state).toBe('victory'); expect(e.trace).toEqual(['armed:0','intro:0','fight:0','beat:1','fight:1','beat:2','fight:2','victory:2']);
    expect(e.saved).toEqual({ defeated: true, rewardTaken: false, kills: 1 }); expect(e.rewards).toBe(1); expect(fight.dead).toBe(true);
  } finally { scope.dispose(); for (const material of materials.values()) material.dispose(); restore(); }
});
