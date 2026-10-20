import { expect, test } from 'vitest';
import * as v from 'valibot';
import { CoupledEncounter, coupledActorDamage, EncounterPatrol, EncounterPatrolSchema, EncounterSchedule } from '../src/game/boss/encounterPatrol';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import night from '../src/shards/nalati-grasslands/data/night.generated.json' with { type: 'json' };
import titan from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import { TITAN_SUPPORT } from '../src/shards/nalati-grasslands/generators/stormTitanFight';

const patrolRows = v.parse(EncounterPatrolSchema, night.patrol);
const frame = { px: 0, py: 30, pz: 24, hold: 0, night: 1 };
const make = (): EncounterPatrol => new EncounterPatrol(night.patrol, ReturnProgram.page(night.program), new Rng(513));

test('the patrol admits once at night and holds its automatic roster', () => {
  const host = make(); let spawns = 0;
  for (let i = 0; i < 8; i++) spawns += Number(host.update(.1, frame, []).spawn);
  expect(spawns).toBe(1);
  host.update(.1, { ...frame, night: 0 }, []);
  for (let i = 0; i < 40; i++) expect(host.update(.1, { ...frame, hold: 1 }, []).spawn).toBe(false);
  host.update(.1, { ...frame, night: 0 }, []);
  spawns = 0;
  for (let i = 0; i < 25; i++) spawns += Number(host.update(.1, frame, []).spawn);
  expect(spawns).toBe(1);
});

test('a killed member is counted once, retires after its fade and resets next night', () => {
  const host = make(), plan = host.plan(1, 0, { x: 0, z: 24 });
  const member = host.add('rider', { quiet: 0 }, plan.group);
  let retired = false, killed = 0;
  for (let i = 0; i < 15; i++) {
    const step = host.update(.1, frame, [{ id: 'rider', x: 0, z: 24, alive: 0, hidden: 0 }]);
    for (const effect of step.effects) {
      killed += Number(effect.killed);
      expect(effect.shoot).toBe(false);
      if (effect.retire) { host.remove(member); retired = true; }
    }
  }
  expect(killed).toBe(1); expect(retired).toBe(true); expect(host.kills).toBe(1);
  host.update(.1, { ...frame, night: 0 }, []);
  host.update(.1, frame, []); expect(host.kills).toBe(0);
});

test('dawn dissolves living riders without charging a kill and stops respawns', () => {
  const host = make(), member = host.add('rider', { quiet: 0 });
  const body = [{ id: 'rider', x: 0, z: 24, alive: 1, hidden: 0 }];
  host.update(.1, frame, body);
  const dawn = host.update(.1, { ...frame, night: 0 }, body);
  expect(member.state['dying']).toBeGreaterThan(0);
  expect(dawn.effects[0]?.shoot).toBe(false); expect(host.kills).toBe(0);
  for (let i = 0; i < 25; i++) expect(host.update(.1, { ...frame, night: 0 }, body).spawn).toBe(false);
});

test('an unrelated harbour patrol uses the host with its own route and group size', () => {
  const rows = { ...patrolRows, parameters: { ...patrolRows.parameters, center: -40, x0: 18, x1: 16, x2: 12, x3: 7,
    z1: 4, z2: 8, z3: 12, z4: 16, d1: 5, d2: 10, d3: 15, d4: 20, canter: 2 } };
  const host = new EncounterPatrol(rows, ReturnProgram.page(night.program), new Rng(81));
  const plan = host.plan(2, 0, { x: 200, z: -40 });
  expect(plan.slots).toHaveLength(2);
  const first = host.add('watch-one', { quiet: 1 }, plan.group, 0);
  host.add('watch-two', { quiet: 1 }, plan.group, 1);
  const update = host.update(.1, { px: 200, py: 0, pz: -40, hold: 1, night: 1 }, [
    { id: 'watch-one', x: 18, z: -40, alive: 1, hidden: 0 }, { id: 'watch-two', x: 7, z: -52, alive: 1, hidden: 0 },
  ]);
  expect(update.effects.every(effect => !effect.shoot)).toBe(true);
  expect(Number.isFinite(first.state['tx'])).toBe(true);
  expect(first.state['v']).toBe(2);
  expect(() => host.plan(9, 0, { x: 0, z: 0 })).toThrow('group size');
});

test('aim motion samples use the patrol cadence and reject teleports inside AS', () => {
  const host = make(), motion = new EncounterSchedule(night.motion, ReturnProgram.page(night.program));
  const first = host.update(.1, frame, []); motion.project({ dt: first.dt, px: 0, pz: 0 });
  expect(motion.value('vx')).toBe(0);
  const next = host.update(.1, { ...frame, px: 1 }, []); motion.project({ dt: next.dt, px: 1, pz: 0 });
  expect(motion.value('vx')).toBe(10);
  expect(host.update(.05, frame, []).dt).toBe(0);
  motion.project({ dt: .1, px: 100, pz: 100 });
  expect(motion.value('vx')).toBe(0); expect(motion.value('vz')).toBe(0);
});

test('bound support bodies consume steering rows and lose their damage owner on retirement', () => {
  const host = new CoupledEncounter(TITAN_SUPPORT, ReturnProgram.page(titan.rules), new Rng(503));
  const body = { entityId: 'support', position: { x: 3, z: 5 }, scale: 1.6, hp: 1, maxHp: 1, alive: true, mem: {} as Record<string, number> };
  const member = host.addActor(body, { theta: 0 }, { x: 0, z: 0 });
  expect(body.hp).toBe(250);
  host.updateActors({ dt: .1, px: 0, pz: 0, hp: 1560, invuln: 0 });
  expect(body.mem['v']).toBe(12); expect(Number.isFinite(body.mem['tx'])).toBe(true);
  member.state['mode'] = 3;
  expect(coupledActorDamage(body, { x: 1, z: 0 })).toBe(3);
  expect(coupledActorDamage(body, { x: 20, z: 0 })).toBe(.5);
  body.alive = false;
  expect(host.updateActors({ dt: .1, px: 0, pz: 0, hp: 1560, invuln: 0 }).state['hp']).toBe(1352);
  expect(host.updateActors({ dt: .1, px: 0, pz: 0, hp: 1352, invuln: 0 }).state['hp']).toBe(1352);
  expect(coupledActorDamage(body, { x: 1, z: 0 })).toBe(1);
});

test('an orchard guardian binds different health and memory fields without a callback', () => {
  const host = new CoupledEncounter({ ...TITAN_SUPPORT, actors: { hp: 40, memory: { targetX: 'x', targetZ: 'z', speed: 'speed' } } }, ReturnProgram.page(titan.rules), new Rng(42));
  const body = { entityId: 'frost-mote', position: { x: -30, z: 10 }, scale: .5, hp: 1, maxHp: 1, alive: true, mem: {} as Record<string, number> };
  host.addActor(body, { theta: 1 }, { x: 8, z: 9 });
  host.updateActors({ dt: .1, px: 8, pz: 9, hp: 500, invuln: 0 });
  expect(body.hp).toBe(40); expect(body.mem['speed']).toBe(12); expect(body.mem['tx']).toBeUndefined();
  host.clear(); expect(host.members).toHaveLength(0); expect(coupledActorDamage(body, { x: 8, z: 9 })).toBe(1);
});

test('an orchard mounted patrol borrows its roster, leader and memory mapping', () => {
  const rows = { ...patrolRows, actors: { kind: 'orchard-watch', variant: 'scout', leader: 'warden', count: 2, herd: -2,
    player: { x: 'seenX', z: 'seenZ' }, target: { x: 'goalX', z: 'goalZ' }, steering: { goalX: 'tx', goalZ: 'tz', speed: 'v' } } };
  const body = (id: string, x: number, z: number, variant: string) => ({ entityId: id, position: { x, z }, variant, herd: 0, alive: true, hidden: false, mem: {} as Record<string, number> });
  type Body = ReturnType<typeof body>;
  let count = 0, retired = 0, warmed = '';
  const host = new EncounterPatrol<Body>(rows, ReturnProgram.page(night.program), new Rng(81));
  expect(host.spawnActors({ x: 0, z: 0 }, {})).toEqual([]);
  host.attachActors({ factory: { model: (kind, variant) => { warmed = `${kind}:${variant}`; } },
    spawn: (_kind, x, z, _yaw, variant) => body(String(count++), x, z, variant), retire: () => { retired++; } });
  const actors = host.spawnActors({ x: 200, z: 24 }, { leader: true, at: 0 });
  expect(warmed).toBe('orchard-watch:scout'); expect(actors.map(row => row.a.variant)).toEqual(['warden', 'scout']);
  host.updateActors(.1, { ...frame, px: 200, hold: 1 });
  const first = actors[0]; if (first === undefined) throw new Error('Missing patrol fixture');
  expect(first.a.herd).toBe(-2); expect(first.a.mem['seenX']).toBe(200); expect(first.a.mem['speed']).toBeGreaterThan(0);
  host.updateActors(.1, { ...frame, hold: 1 }, true);
  expect(first.a.mem['goalX']).toBe(first.a.position.x);
  host.dissolveActor(first.a); expect(first.law.state['dying']).toBeGreaterThan(0);
  host.retireActor(first.a); host.retireActor(first.a); expect(retired).toBe(1);
  expect(host.members).toHaveLength(1);
});
