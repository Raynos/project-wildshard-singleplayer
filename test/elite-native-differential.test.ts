import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import * as reach from '../src/engine/ai/reach';
import { NALATI_STRIKES } from './fixtures/nalati-strikes';
import { installEliteEncounters, eliteBindings, type EliteEncounterPorts, type EliteEncounterRow } from '../src/game/shardfile/eliteEncounters';
import { installEliteEncounters as originalInstall, type EliteEncounterPorts as OriginalPorts, type EliteEncounterRow as OriginalRow } from './fixtures/originalEliteEncounters';
import type { SimHost } from '../src/engine/sim';
import { legacyDouble } from './fake/FakeGame';
import { nativeKernelOwners } from './fixtures/nativeEliteKernelOwners';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };

function encounter(pattern: 'pouncer' | 'howler', original: boolean) {
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
  const bindings = eliteBindings(), common = {
    bindings, bodies: () => [f.actor], spawn: () => f.actor, retire: () => undefined,
    packs: () => [], spawnPack: () => { throw new Error('Unexpected pack allocation'); }, retirePack: () => undefined,
  };
  const nativeRow: OriginalRow = { def: row.def, keeper: pattern, snapshot: 'member', member: { kind: row.kind, variant: row.def.id, source: 'boot', yaw: row.yaw } };
  const spec = { step: 'marsh.elites', version: 1, conditions: { mode: 'phase' as const, phase: () => 'day', storm: () => false }, wire: {} };
  const instance = original ? originalInstall(f.host, { ...spec, rows: [nativeRow], ports: legacyDouble<OriginalPorts>({ ...common,
    ledges: [], heightAt: () => 0, environment: () => f.loans.environment, keepers: legacyDouble<OriginalPorts['keepers']>({ [pattern]: row.spec }),
    strikes: NALATI_STRIKES, swipeDamage: 14,
    strike: (strike, actor, target, hit, ports) => f.loans.contacts.contact(strike, { actor, target, hit, canReach: ports.reach }),
    knock: { duration: 1, dash: (x, z, _strength, out) => { const length = Math.hypot(x, z) || 1; out.x = x / length * 9; out.z = z / length * 9; } },
  }) }) : installEliteEncounters(f.host, { ...spec, rows: [{ ...nativeRow, keeper: 'kernel' } satisfies EliteEncounterRow],
    ports: legacyDouble<EliteEncounterPorts>({ ...common, keepers: { herd: { rows: {}, program: {} } }, kernels: {
      ...f.loans, rows: f.rows.filter(candidate => candidate.profile.pattern === pattern),
    } }),
  });
  const script = instance.scripts[0]; if (script === undefined || saved === undefined) throw new Error('Missing native owner');
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
