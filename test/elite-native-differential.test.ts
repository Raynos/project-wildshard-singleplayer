import { nativeEliteCore } from './fixtures/nativeEliteCore';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { PackBrain, type PackPorts } from '../src/engine/ai/pack';
import { nativeGroupBrain } from '../src/format/groupBrains';
import brainRows from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import * as reach from '../src/engine/ai/reach';
import { NALATI_STRIKES } from './fixtures/nalati-strikes';
import { installEliteEncounters, eliteBindings, type EliteEncounterPorts, type EliteEncounterRow } from '../src/game/shardfile/eliteEncounters';
import { installEliteEncounters as originalInstall, type EliteEncounterPorts as OriginalPorts, type EliteEncounterRow as OriginalRow } from './fixtures/originalEliteEncounters';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { SimHost } from '../src/engine/sim';
import { legacyDouble } from './fake/FakeGame';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };

function encounter(pattern: 'pouncer' | 'howler', original: boolean, withPack = false) {
  const f = nativeKernelOwners(), row = ecology.keeperElites.find(candidate => candidate.pattern === pattern);
  if (row === undefined || row.pattern === 'wind') throw new Error('Missing native profile');
  let saved: Parameters<SimHost['onStep']>[2];
  Object.defineProperty(f.host, 'onStep', { value: (_id: string, _step: unknown, adapter: Parameters<SimHost['onStep']>[2]) => { saved = adapter; return () => undefined; } });
  const events: unknown[] = [];
  Object.assign(f.actor, { kind: row.kind, variant: row.def.id, yOffset: 0, lookTarget: new Vector3(), lookWeight: 0, lastHitT: -Infinity, startAttack: vi.fn(), stagger: vi.fn() });
  f.actor.setMotion = (yaw, speed, turn) => { events.push(['move', yaw, speed, turn]); };
  f.hit.mockImplementation((hit: Parameters<SimHost['combat']['hit']>[0]) => {
    if (hit.cause === undefined) throw new Error('Missing original native hit cause');
    events.push(['hit', hit.amount, hit.cause.kind, hit.cause.label, [...hit.sourceTags], hit.point.toArray()]);
  });
  f.dash.mockImplementation((x, z, seconds) => { events.push(['dash', x, z, seconds]); });
  const packActor = legacyDouble<AnimalSim>({ entityId: 'body.2', kind: 'wolf', variant: 'grey', scale: 1, maxHp: 100 });
  f.host.entities.set(packActor.entityId, packActor);
  const packs: PackBrain<AnimalSim>[] = [], bindings = eliteBindings(), common = {
    bindings, bodies: () => [f.actor],
    spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => { events.push(['spawn', kind, x, z, yaw, variant, f.host.rng.stream('ai').next()]); return f.actor; },
    retire: (actor: AnimalSim) => { events.push(['retire', actor.entityId]); }, packs: () => packs,
    spawnPack: (x: number, z: number, variants: readonly string[]) => {
      events.push(['pack', x, z, [...variants], f.host.rng.stream('ai').next()]);
      const profile = nativeGroupBrain({ ...brainRows.pack, id: 'quarry.group', home: [x, z], members: [packActor.entityId] });
      if (profile.kind !== 'pack') throw new Error('Missing group profile');
      const pack = new PackBrain<AnimalSim>([packActor], x, z, profile, legacyDouble<PackPorts<AnimalSim>>({})); packs.push(pack); return pack;
    },
    retirePack: (pack: PackBrain<AnimalSim>) => { events.push(['retire-pack', packs.indexOf(pack), pack.homeX, pack.homeZ]); },
  };
  const nativeRow: OriginalRow = { def: row.def, keeper: pattern, snapshot: 'member', member: { kind: row.kind, variant: row.def.id, source: 'boot', yaw: row.yaw, memory: { marker: 3 } }, ...(withPack ? { pack: { offset: [-6, 4], variants: ['grey'], kind: 'wolf', idPrefix: 'body.' } } : {}) };
  const spec = { step: 'marsh.elites', version: 1, conditions: { mode: 'phase' as const, phase: () => 'day', storm: () => false }, wire: {} };
  let live: ReturnType<typeof installEliteEncounters> | undefined;
  const instance = original ? originalInstall(f.host, { ...spec, rows: [nativeRow], ports: legacyDouble<OriginalPorts>({ ...common,
    ledges: [], heightAt: () => 0, environment: () => f.loans.environment, keepers: legacyDouble<OriginalPorts['keepers']>({ [pattern]: row.spec }),
    strikes: NALATI_STRIKES, swipeDamage: 14,
    strike: (strike, actor, target, hit, ports) => f.loans.contacts.contact(strike, { actor, target, hit, canReach: ports.reach }),
    knock: { duration: 1, dash: (x, z, _strength, out) => { const length = Math.hypot(x, z) || 1; out.x = x / length * 9; out.z = z / length * 9; } },
  }) }) : (live = installEliteEncounters(f.host, { ...spec, core: nativeEliteCore(f.host), rows: [{ ...nativeRow, keeper: 'kernel' } satisfies EliteEncounterRow],
    ports: legacyDouble<EliteEncounterPorts>({ ...common, groups: { packs, herds: [] }, keepers: { herd: { rows: {}, program: {} } }, kernels: {
      ...f.loans, rows: f.rows.filter(candidate => candidate.profile.pattern === pattern),
    } }),
  }));
  const script = instance.scripts[0]; if (script === undefined || saved === undefined) throw new Error('Missing native owner');
  live?.bindPopulation({ host: f.host, bodies: [f.actor], spawnElite: common.spawn, retireElite: common.retire, spawnElitePack: common.spawnPack, retirePack: common.retirePack });
  script.spawn();
  return { ...f, script, saved, events, bindings };
}

for (const pattern of ['pouncer', 'howler'] as const) test(`${pattern} native rows preserve original frame order, RNG and active continuation bytes`, () => {
  const canReach = vi.spyOn(reach, 'canReach').mockReturnValue(true), old = encounter(pattern, true), live = encounter(pattern, false);
  try {
    for (let tick = 0; tick < 400; tick++) {
      for (const f of [old, live]) {
        Object.defineProperty(f.actor, 'attackPhase', { value: tick % 10 === 9 ? 1 : .9 });
        if (tick === 200) f.script.enterPhase2();
        f.script.tick(.1, tick / 10, true, false);
        const binding = f.bindings.brains.get(f.actor); if (binding === undefined) throw new Error('Missing native body binding');
        binding.think(f.actor, { dt: .1, player: f.host.player.position, pathYaw: () => 0 }); binding.act(f.actor);
        if (tick === 80) f.saved.restore(f.saved.snapshot());
      }
      expect(JSON.stringify(live.saved.snapshot())).toBe(JSON.stringify(old.saved.snapshot()));
      expect(live.actor.mem).toEqual(old.actor.mem); expect(live.actor.position.toArray()).toEqual(old.actor.position.toArray());
      expect(live.actor.yOffset).toBe(old.actor.yOffset); expect(live.events).toEqual(old.events);
      expect(live.host.rng.snapshot()).toEqual(old.host.rng.snapshot());
    }
    if (pattern === 'howler') expect(live.host.rng.snapshot().streams.length).toBeGreaterThan(0);
    expect(live.hit.mock.calls.length).toBeGreaterThan(0);
  } finally { canReach.mockRestore(); old.scope.dispose(); live.scope.dispose(); }
});

for (const pattern of ['pouncer', 'howler'] as const) test(`${pattern} lifecycle preserves original boot, reset, pack retirement and allocated respawn continuation`, () => {
  const old = encounter(pattern, true, true), live = encounter(pattern, false, true);
  try {
    for (const operation of ['enterPhase2', 'reset', 'despawn', 'spawn', 'despawn', 'spawn'] as const) {
      old.script[operation](); live.script[operation]();
      expect(live.script.animal).toBe(operation === 'despawn' ? null : live.actor);
      expect(JSON.stringify(live.saved.snapshot())).toBe(JSON.stringify(old.saved.snapshot()));
      expect(live.actor.mem).toEqual(old.actor.mem); expect(live.actor.herd).toBe(old.actor.herd);
      expect(live.events).toEqual(old.events); expect(live.host.rng.snapshot()).toEqual(old.host.rng.snapshot());
      expect(live.bindings.brains.has(live.actor)).toBe(old.bindings.brains.has(old.actor));
      expect(live.bindings.pinned.has(live.actor)).toBe(old.bindings.pinned.has(old.actor));
    }
    live.saved.restore(live.saved.snapshot()); old.saved.restore(old.saved.snapshot());
    expect(JSON.stringify(live.saved.snapshot())).toBe(JSON.stringify(old.saved.snapshot()));
  } finally { old.scope.dispose(); live.scope.dispose(); }
});
