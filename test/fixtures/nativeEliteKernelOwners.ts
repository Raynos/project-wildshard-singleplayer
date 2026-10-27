import {lendNalatiAdmission} from './nalati-return-modules';
import { vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import type { SimHost } from '../../src/engine/sim';
import { RngService } from '../../src/engine/core/rng';
import { StrikeRunner } from '../../src/engine/ai/strikes';
import type { NativeEliteKernelLoans, NativeEliteKernelRow } from '../../src/engine/ai/eliteKernels';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { NALATI_STRIKES } from './nalati-strikes';
import { NALATI_ECOLOGY as ecology } from '../../src/shards/nalati-grasslands/generators/ecology.mjs';

export function nativeKernelOwners(scope = new Scope('native-elites')) {
  lendNalatiAdmission(scope);
  const rng = new RngService(19), health = legacyDouble<SimHost['player']['health']>({});
  const hit = vi.fn(), dash = vi.fn(), signature = vi.fn();
  const host = legacyDouble<SimHost>({ scope, entities: new Map(), clock: legacyDouble<SimHost['clock']>({ now: 0 }), hasStep: () => false, level: legacyDouble<SimHost['level']>({ id: 'marsh' }),
    player: legacyDouble<SimHost['player']>({ position: new Vector3(0, 0, .5), health }), physics: legacyDouble<SimHost['physics']>({}),
    combat: legacyDouble<SimHost['combat']>({ hit }), rng, dashPlayer: dash });
  const loans: NativeEliteKernelLoans = { scope, host, lifecycle: { signature }, contacts: new StrikeRunner(),
    strikes: [NALATI_STRIKES.swipe, NALATI_STRIKES.pounce, NALATI_STRIKES.bite], terrain: { heightAt: () => 0 },
    environment: { playerCrouched: false, playerFwdX: 0, playerFwdZ: 1, playerMounted: false, playerHealth01: 1,
      light: 1, storm: false, wind: { x: -.8, z: .6, strength: .5 }, grassHeightAt: () => .55 },
    ledges: [], brains: new Map() };
  const rows: NativeEliteKernelRow[] = ecology.keeperElites.flatMap(profile => profile.pattern === 'wind' ? [] : [{ id: profile.def.id,
    profile: { pattern: profile.pattern, spec: profile.spec }, lair: { x: profile.def.lair.x, z: profile.def.lair.z }, awareRadius: profile.def.awareR,
    contacts: profile.pattern === 'howler' ? [] : [{ amount: 14, strike: NALATI_STRIKES.swipe.id }],
    fallbackStrike: (profile.pattern === 'howler' ? NALATI_STRIKES.bite : NALATI_STRIKES.pounce).id,
    knockdown: { speed: 9, min: 0, max: 1, seconds: 1 } }]);
  const combat = legacyDouble<ReturnType<AnimalSim['combatActor']>>({});
  const actor = legacyDouble<AnimalSim>({ entityId: 'body.1', kind: 'leopard', variant: rows[0]?.id ?? '', label: 'Guardian',
    alive: true, position: new Vector3(), scale: 1, yaw: 0, mem: {}, herd: -1, attackPhase: .9,
    dims: legacyDouble<AnimalSim['dims']>({ headRadius: .2, bodyY: 1, bodyRadius: .3 }),
    headWorld: out => out.set(0, 1, 0), setMotion: vi.fn(), cancelAttack: vi.fn(), combatActor: () => combat });
  host.entities.set(actor.entityId, actor);
  return { scope, host, rows, loans, hit, dash, signature, actor, combat };
}
