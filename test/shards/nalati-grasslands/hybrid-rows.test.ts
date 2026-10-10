import { expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { Weapon } from '../../../src/engine/combat/Weapon';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import { INPUT_CONTEXTS } from '../../../src/game/inputContexts';
import { withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import manifest from '../../../src/shards/nalati-grasslands/manifest';
import { NALATI_QUESTS } from '../../../src/shards/nalati-grasslands/quest';
import { NALATI_FEATS } from '../../../src/shards/nalati-grasslands/feats';
import { AR15, BOW, SABRE, SPEAR } from '../../../src/shards/nalati-grasslands/weapons/equipment';
import { bindNalatiItems } from '../../../src/shards/nalati-grasslands/runtime/items';
import { DUNGEON, COFFIN } from '../../../src/shards/nalati-grasslands/world/KurganDungeon';

class NativeWeapon extends Weapon {
  readonly model = { visible: false, parent: null, removeFromParent: () => undefined };
  readonly state = { ammo: 5, magazine: 5, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; adsHeld = false; aimInfo = null; shots = 0;
  tryFire(): void { this.shots++; }
  update(): void { /* Native family behavior stays outside the declaration adapter. */ }
}

it('declares the unchanged chapters, feats, native equipment and fixed coffin body while retaining runtime ownership', () => {
  expect(source.runtime?.binds).toEqual(['quests', 'ledger', 'state', 'items', 'spawns']);
  expect(source.quests.quests.map(({ onComplete: _reward, ...quest }) => quest)).toEqual(NALATI_QUESTS);
  expect(source.ledger.flatMap((row) => row.rewards.flatMap((reward) => reward.kind === 'achievement' ? [reward.id] : []))).toEqual(NALATI_FEATS.map((feat) => feat.id));
  expect(source.items.rows.map((row) => [row.id, row.family])).toEqual([
    ['weapon.bow', 'nalati-grasslands.bow'], ['weapon.sabre', 'nalati-grasslands.sabre'],
    ['weapon.spear', 'nalati-grasslands.spear'], ['weapon.rifle', 'nalati-grasslands.rifle'],
  ]);
  expect(source.runtime?.spawns?.bosses).toEqual([{ id: 'nalati.golden-king', kind: 'golden-king', look: 'king',
    at: [DUNGEON.x + COFFIN.x, DUNGEON.z + COFFIN.z], yaw: 0 }]);
  const data = withoutRuntimeRows(source);
  expect([data.quests.quests.length, data.quests.flags.length, data.ledger.length, data.items.rows.length, data.state.shared.length]).toEqual([0, 0, 0, 0, 0]);
  expect(data.audio).toBe(source.audio); expect(data.edge).toBe(source.edge);
});

it('adopts the four existing native weapons without allocation, identity, ammo, model, cue or presentation changes', () => {
  const app = new App(), scope = app.engineScope;
  const weapons = { bow: new NativeWeapon(BOW), sabre: new NativeWeapon(SABRE), spear: new NativeWeapon(SPEAR), rifle: new NativeWeapon(AR15) };
  const before = Object.values(weapons).map((weapon) => ({ weapon, row: weapon.row, model: weapon.model, state: weapon.state, id: weapon.id }));
  try {
    for (const row of INPUT_CONTEXTS) app.input.register(row, scope);
    // the weapon-hook row stays at its default (off): nothing is fetched and the sabre keeps its row rule
    bindNalatiItems({ app, scope, game: { shard: manifest, rows: new Map(), bag: new TabRegistry() }, debugRow: () => undefined }, weapons);
    for (const { weapon, row, model, state, id } of before) {
      expect(weapon.id).toBe(id); expect(weapon.row.legacySlot).toBe(id); expect(weapon.row.id).toBe(row.id);
      expect(weapon.row.meta).toBe(row.meta); expect(weapon.model).toBe(model); expect(weapon.state).toBe(state);
      const declared = source.items.rows.find((item) => item.id === row.id);
      if (declared?.kind !== 'weapon') throw new Error('Missing declared native weapon');
      expect(weapon.row.ui).toEqual({ ...row.ui, inputContext: declared.context });
      expect(weapon.row.cues).toEqual(row.cues); expect(weapon.row.hitStop).toEqual(row.hitStop); expect(weapon.row.rangedFeel).toEqual(row.rangedFeel);
      weapon.tryFire(); expect(weapon.shots).toBe(1);
    }
  } finally { scope.dispose(); }
});
