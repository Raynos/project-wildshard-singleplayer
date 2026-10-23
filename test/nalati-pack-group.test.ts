import { Vector3 } from 'three';
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { PackBrain, type PackPorts } from '../src/engine/ai/pack';
import { nativeGroupBrain } from '../src/format/groupBrains';
import { ReturnProgram } from '../src/game/population/returnProgram';
import brains from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import { PACK_PROFILE } from '../src/shards/nalati-grasslands/generators/packGroup';
import packBinding from '../src/shards/nalati-grasslands/data/packGuest.json' with { type: 'json' };
import packSource from '../src/shards/nalati-grasslands/behaviour/pack.as?raw';
import { SIM_LEVEL } from './fixtures/sim-level/level';

// R10b: Nalati's wolf pack law (behaviour/pack.as) runs as the 'pack' profile of the shared pasture programme. A PackBrain
// bound to the shipped programme runs every original call as the same law its unbound TS copy runs.
function programme(scope: Scope): { groupBindings: NonNullable<ReturnType<typeof ReturnProgram.page>['groupBindings']>; prepareGroup: NonNullable<ReturnType<typeof ReturnProgram.page>['prepareGroup']> } {
  const program = ReturnProgram.page(programs.wind, scope);
  if (program.prepareGroup === undefined || program.groupBindings === undefined) throw new Error('The pasture programme carries no group steps');
  return { groupBindings: program.groupBindings, prepareGroup: program.prepareGroup };
}

test('the pack program\'s spec constants are Nalati\'s wolf pack row', () => {
  const spec = /SPEC: StaticArray<f64> = \[([^\]]+)\]/u.exec(packSource)?.[1]?.split(',').map(Number), p = brains.pack;
  expect(spec).toStrictEqual([p.trotSpeed, p.runSpeed, p.shadowMinRadius, p.shadowMaxRadius, p.ringMinRadius, p.ringMaxRadius, p.biteRadius,
    p.sightRadius, p.coneAngle, p.smellRadius, p.telegraphSeconds, p.dashSeconds, p.breakoffSeconds, p.attackSeconds]);
  const hearing = PACK_PROFILE.actions.find(row => row.native?.kind === 'hearing')?.native;
  expect(hearing !== undefined && 'radii' in hearing ? [...hearing.radii] : null).toStrictEqual(p.hearing);
  expect(/const HALF: f64 = ([0-9.]+);/u.exec(packSource)?.[1]).toBe('250');
});

type Log = (string | number)[][];
const round = (value: number): number => Math.round(value * 1e6) / 1e6;
function roster(tag: string): AnimalSim[] {
  const sample = SIM_LEVEL.entities[0]; if (sample === undefined) throw new Error('Missing wolf recipe');
  return [0, 1, 2, 3, 4].map(i => {
    const wolf = new AnimalSim(sample.spec, sample.seed + i, [1.1, 1, .9, 1, .8][i] ?? 1, `${tag}:wolf:${i}`, { heightAt: () => 0, random: () => .5, now: () => 0 });
    wolf.position.set(60 + i * 3, 0, 40 - i * 2); wolf.yaw = 0; return wolf;
  });
}
function side(tag: string, log: Log) {
  const shared = new Rng(7), context = new Rng(11), wolves = roster(tag);
  const ports: PackPorts<AnimalSim> = { sharedRng: () => shared,
    environment: () => ({ playerFwdX: 0, playerFwdZ: -1, playerMounted: false, playerHealth01: 1, grassHeightAt: () => .5 }),
    visibility: () => 1, hearing: () => 10, downwind: () => false, inBounds: () => true, normalY: () => 1,
    register: () => undefined, bite: (actor, _c, radius) => { log.push(['bite', actor.entityId.split(':')[2] ?? '', round(radius)]); },
    onEvent: (event, x, z) => { log.push(['event', event, round(x), round(z)]); } };
  const context0 = (t: number, player: Vector3) => ({ dt: .1, t, player, playerSpeed: 3, calm: false, rng: context,
    sound: (cue: string) => { log.push(['sound', cue]); }, claim: () => true,
    steer: (actor: AnimalSim, yaw: number, speed: number, turn: number) => { log.push(['steer', actor.entityId.split(':')[2] ?? '', round(yaw), round(speed), round(turn)]);
      actor.yaw = yaw; actor.position.x += Math.sin(yaw) * speed * .1; actor.position.z += Math.cos(yaw) * speed * .1; },
    pathYaw: (actor: AnimalSim, x: number, z: number) => Math.atan2(x - actor.position.x, z - actor.position.z) });
  return { wolves, ports, context0 };
}
const MEM = ['role', 'ox', 'oz', 'ring', 'lunge', 'lt', 'bit', 'st', 'sx', 'sz', 'low', 'snarl', 'howl', 'hidden'];

test('a bound PackBrain runs the pack program as its own unbound TS law, tick for tick', { timeout: 600_000 }, () => {
  const scope = new Scope('nalati.pack-group'), projection = programme(scope);
  const spec = nativeGroupBrain({ ...brains.pack, id: 'nalati.wolf-pack', home: [60, 40], members: ['wolf'] }); if (spec.kind !== 'pack') throw new Error('Missing pack spec');
  const oracleLog: Log = [], scriptLog: Log = [];
  const a = side('a', oracleLog), b = side('b', scriptLog);
  try {
    const oracle = new PackBrain(a.wolves, 60, 40, spec, a.ports), scripted = new PackBrain(b.wolves, 60, 40, spec, b.ports);
    scripted.bindGuest(projection, packBinding, { scope, group: 'pack', handle: 100, roster: () => [] });
    // as PageGroups does: the foal hunt's roll happens only with a findPrey (none in reach here)
    oracle.findPrey = () => null;
    scripted.findPrey = () => null;
    oracle.initialize(); scripted.initialize();
    const states = (wolves: AnimalSim[]): unknown => wolves.map(w => [w.state, ...MEM.map(key => round(w.mem[key] ?? 0))]);
    expect(states(b.wolves)).toStrictEqual(states(a.wolves));
    const phases: string[] = [], seen = new Map<string, number>();
    for (let tick = 1; tick <= 600; tick++) {
      const t = tick * .1, player = new Vector3(Math.max(64, 120 - tick * .25), 0, 40); // walks in and stands at the pack
      const ca = a.context0(t, player), cb = b.context0(t, player);
      oracle.tick(ca); for (const w of a.wolves) oracle.drive(w, ca); for (const w of a.wolves) oracle.drive(w, ca, true);
      scripted.tick(cb); for (const w of b.wolves) scripted.drive(w, cb); for (const w of b.wolves) scripted.drive(w, cb, true);
      if (phases.at(-1) !== oracle.phase) phases.push(oracle.phase);
      expect([tick, scripted.phase, round(scripted.awareness)]).toStrictEqual([tick, oracle.phase, round(oracle.awareness)]);
      expect([tick, states(b.wolves)]).toStrictEqual([tick, states(a.wolves)]);
      for (const row of oracleLog) { const key = `${row[0]}:${row[1]}`; seen.set(key, (seen.get(key) ?? 0) + 1); }
      expect([tick, scriptLog.splice(0)]).toStrictEqual([tick, oracleLog.splice(0)]);
    }
    expect(phases.length).toBeGreaterThan(2); // the run reached past roam
    // the attack path ran: a granted token's lunge (snarl), a bite at reach, and the phases past roam
    expect(phases).toContain('encircle');
    expect(seen.get('sound:wolf_snarl') ?? 0).toBeGreaterThan(0);
    expect([...seen].filter(([key]) => key.startsWith('bite:')).length).toBeGreaterThan(0);
  } finally { scope.dispose(); }
});
