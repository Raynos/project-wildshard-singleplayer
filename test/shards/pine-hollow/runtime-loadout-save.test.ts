// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { MeshStandardMaterial, Scene } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { appIdentity } from '../../../src/engine/app/identity';
import { CombatCues } from '../../../src/engine/combat/cues';
import type { EquipmentService } from '../../../src/engine/combat/EquipmentService';
import type { Weapon } from '../../../src/engine/combat/Weapon';
import type { Audio } from '../../../src/engine/audio/Audio';
import type { HUD } from '../../../src/engine/ui/HUD';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import type { Inventory } from '../../../src/game/Inventory';
import type { Owned } from '../../../src/game/loot/Owned';
import type { Bow } from '../../../src/game/weapons/Bow';
import type { LeverRifle } from '../../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import type { CrossbowWeapon } from '../../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { bindRuntimeState } from '../../../src/game/shardfile/hybridRows';
import source from '../../../src/shards/pine-hollow/shard.config';
import { installPineLoadout } from '../../../src/shards/pine-hollow/loadout/loadout';
import { LEVER, LONGBOW } from '../../../src/shards/pine-hollow/weapons/equipment';
import { legacyDouble } from '../../fake/FakeGame';

it('C26 restores current special ammunition through the real installer and leaves its legacy slot untouched', () => {
  const scope = app.engineScope.child('pine.ammo.c26'), key = `${appIdentity().savePrefix}pine-hollow`;
  const saved = { pitch: 4, broadhead: 7, rounds: 19, arrows: 8 };
  localStorage.setItem(key, JSON.stringify({ keys: { loadout: { v: 1, data: saved } } }));
  const rifle = legacyDouble<LeverRifle>({ row: LEVER, state: legacyDouble<LeverRifle['state']>({ reserve: 0, ammo: 0 }) });
  const longbow = legacyDouble<Bow>({ row: LONGBOW, state: legacyDouble<Bow['state']>({ bolts: 0 }) });
  const current = legacyDouble<Weapon>({ enabled: true, id: 'crossbow', ammoSelect: () => undefined });
  const crossbow = legacyDouble<CrossbowWeapon>({ boltMaterial: new MeshStandardMaterial(), state: legacyDouble<CrossbowWeapon['state']>({ bolts: 30, loaded: true, reloading: false }) });
  try {
    const loadout = installPineLoadout({ scope, scene: new Scene(), cues: new CombatCues(), crossbow, rifle, longbow,
      weapons: legacyDouble<EquipmentService>({ enabled: true, current, events: app.events, has: () => false }),
      sky: legacyDouble<SkyRig>({ setupMaterial: () => undefined }), audio: legacyDouble<Audio>({}), hud: legacyDouble<HUD>({}),
      inventory: legacyDouble<Inventory>({ had: () => false }), owned: legacyDouble<Owned>({ has: () => false }), params: new URLSearchParams() });
    expect([loadout.count('pitch'), loadout.count('broadhead'), rifle.state.reserve, longbow.state.bolts]).toEqual([4, 7, 19, 8]);
    rifle.state.reserve = 17; longbow.state.bolts = 6; loadout.update(3);
    const document: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    expect(document).toMatchObject({ keys: { loadout: { v: 1, data: saved }, 'platform.runtime-state': { data: { initialized: [2] } } } });
    const state = bindRuntimeState({ app, scope }, source, 'pine.loadout', () => null);
    const migrated: unknown = JSON.parse(String(state.read()));
    expect(migrated).toEqual({ pitch: 4, broadhead: 7, rounds: 17, arrows: 6 });
  } finally { scope.dispose(); }
});
