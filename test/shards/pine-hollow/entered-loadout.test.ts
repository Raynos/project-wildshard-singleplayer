// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { parseAudioData } from '@wildshard/format/audio';
import source from '../../../src/shards/pine-hollow/shard.config';
import { Scene } from 'three';
import { app } from '../../../src/engine/app/runtime';
import type { Audio } from '../../../src/engine/audio/Audio';
import { CombatCues } from '../../../src/engine/combat/cues';
import type { EquipmentService } from '../../../src/engine/combat/EquipmentService';
import type { Weapon } from '../../../src/engine/combat/Weapon';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import type { HUD } from '../../../src/engine/ui/HUD';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import type { Bow } from '../../../src/game/weapons/Bow';
import type { Inventory } from '../../../src/game/Inventory';
import type { Owned } from '../../../src/game/loot/Owned';
import { shardContext } from "../../../src/game/plugin/context";
import { RetainedRuntimeHooks } from "../../../src/game/shard/retainedHooks";
import { emptyShardfileSource } from '../../../src/game/plugin/ui';
import { emptyShardfile } from '../../../src/sdk/author';
import { installPineLoadout } from '../../../src/shards/pine-hollow/loadout/loadout';
import type { PineHollowSfx } from '../../../src/shards/pine-hollow/runtime/audio/sfx';
import { LEVER, LONGBOW } from '../../../src/shards/pine-hollow/weapons/equipment';
import type { LeverRifleWeapon } from '../../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { legacyDouble } from '../../fake/FakeGame';

it.each([false, true])('reinstalls bolt input and emitted cues and cancels the echo on leave (emitted=%s)', (emitted) => {
  vi.useFakeTimers();
  const scope = app.engineScope.child('pine.loadout'), before = app.events.census();
  const manifest = emptyShardfileSource(emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Fixture', seed: 1, revision: 1 }));
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const hooks = new RetainedRuntimeHooks(shardContext(installation.context, manifest, { shard: manifest, rows: new Map(),
    bag: { tab: () => () => undefined, fragment: () => () => undefined } }));
  if (emitted) {
    const wire = JSON.stringify(source.audio), rows = parseAudioData(JSON.parse(wire));
    const fire = rows.routing.find(row => row.id === 'cue.lever.fire')?.actions[0];
    if (fire === undefined) throw new Error('Missing emitted lever fire');
    fire.voice = 'pine.leverDry';
    const echo = rows.routing.flatMap(row => row.actions).find(action => action.voice === 'pine.leverEcho');
    if (echo === undefined) throw new Error('Missing emitted lever echo');
    echo.delay = 0.12; echo.overrides = { gain: 0.37 };
    Object.defineProperty(hooks.context.game, 'declaredAudio', { value: rows });
  }
  let cycles = 0, recovered = 0;
  const shots: string[] = [], echoes: number[] = [];
  const current = legacyDouble<Weapon>({ enabled: true, ammoSelect: () => { cycles++; } });
  const weapons = legacyDouble<EquipmentService>({ enabled: true, current, events: app.events });
  const rifle = legacyDouble<LeverRifleWeapon>({ row: LEVER, state: legacyDouble<LeverRifleWeapon['state']>({ reserve: 3 }) });
  const longbow = legacyDouble<Bow>({ row: LONGBOW, state: legacyDouble<Bow['state']>({ bolts: 4 }) });
  const cues = new CombatCues();
  try {
    const loadout = installPineLoadout({ context: hooks.context, scope, scene: new Scene(), cues, weapons, crossbow: null, rifle, longbow,
      sky: legacyDouble<SkyRig>({}), audio: legacyDouble<Audio>({}), params: new URLSearchParams(),
      inventory: legacyDouble<Inventory>({ had: () => false }), owned: legacyDouble<Owned>({ has: () => false }),
      hud: legacyDouble<HUD>({ toast: () => { recovered++; } }),
    });
    loadout.useSfx(legacyDouble<PineHollowSfx>({ shot: (name, opts) => { shots.push(name); if (name === 'leverEcho') echoes.push(opts?.gain ?? 1); return true; }, prewarm: () => undefined }));
    const press = () => { app.input.executeCommand({ kind: 'press', action: 'bolt.cycle', at: 1 }); };
    const cycle = () => { app.events.emit('weapon.action', { id: LEVER.id, phase: 'cycle' }); app.events.flush('update'); };
    const recover = () => { app.events.emit('weapon.charge', { id: LONGBOW.id, phase: 'recover', value: 1 }); app.events.flush('update'); };
    for (let entry = 0; entry < 2; entry++) {
      if (entry > 0) hooks.activate();
      expect(app.input.snapshot().contexts.filter((id) => id === 'crossbow.bolts')).toHaveLength(1);
      press(); cycle(); recover();
      expect(cycles).toBe(entry + 1); expect(recovered).toBe(entry + 1);
      expect(shots.filter((name) => name === 'leverCycle')).toHaveLength(entry + 1);
      expect(cues.cue('cue.lever.fire')).toBe(true);
      expect(shots.at(-1)).toBe(emitted ? 'leverDry' : 'leverShot');
      if (emitted) {
        vi.advanceTimersByTime(119); expect(echoes).toHaveLength(entry);
        vi.advanceTimersByTime(1); expect(echoes).toEqual(Array.from({ length: entry + 1 }, () => 0.37));
        expect(cues.cue('cue.lever.fire')).toBe(true);
      }
      hooks.deactivate();
      expect(app.input.snapshot().contexts).not.toContain('crossbow.bolts');
      expect(app.events.census()).toEqual(before);
      const frozen = shots.length;
      vi.advanceTimersByTime(5000); press(); cycle(); recover();
      expect(cues.cue('cue.lever.fire')).toBe(false);
      expect(cycles).toBe(entry + 1); expect(recovered).toBe(entry + 1); expect(shots).toHaveLength(frozen);
      if (emitted) expect(echoes).toHaveLength(entry + 1); else expect(shots).not.toContain('leverEcho');
    }
  } finally { scope.dispose(); vi.useRealTimers(); }
  expect(scope.census).toMatchObject({ listeners: 0, timers: 0, disposers: 0 });
});
