import { describe, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { appIdentity } from '../../../src/engine/app/identity';
import type { Weapon } from '../../../src/engine/combat/Weapon';
import type { GameServices, ShardContext } from '../../../src/game/shard/context';
import { installDeclaredItems, type DeclaredItemPorts } from '../../../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../../../src/game/systems/items/declared';
import type { ItemFamilyPorts } from '../../../src/engine/combat/itemFamilies';
import { withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import manifest from '../../../src/shards/nine-dragon-stack/manifest';
import { JIAN_ROW } from '../../../src/shards/nine-dragon-stack/vm/jianRow';
import { FEI_ZHUA_ROW } from '../../../src/shards/nine-dragon-stack/grapple/row';
import { FeiZhua } from '../../../src/shards/nine-dragon-stack/grapple/FeiZhua';
import { bindNineItems } from '../../../src/shards/nine-dragon-stack/runtime/items';
import { legacyDouble } from '../../fake/FakeGame';

function fixture() {
  const scope = app.engineScope.child('nine.runtime-items');
  if (JIAN_ROW.legacySlot === undefined) throw new Error('Shipping Jian needs its legacy slot');
  const primary = legacyDouble<Weapon>({ row: JIAN_ROW, id: JIAN_ROW.legacySlot });
  const game = legacyDouble<GameServices>({ runtime: legacyDouble<NonNullable<GameServices['runtime']>>({
    world: legacyDouble<NonNullable<NonNullable<GameServices['runtime']>['world']>>({
      game: legacyDouble<NonNullable<NonNullable<GameServices['runtime']>['world']>['game']>({ scene: new Scene() }),
    }),
  }) });
  const ctx = legacyDouble<ShardContext>({ app, scope, game });
  return { scope, primary, ctx, grapple: new FeiZhua(ctx) };
}
describe('Nine Dragon runtime-owned fragment (SF51-p)', () => {
  it('declares only its two shipping items, preserving empty gameplay and the checked portal floors', () => {
    expect(source.runtime?.binds).toEqual(['items']);
    expect(source.items.rows.map(row => [row.id, row.family])).toEqual([
      ['weapon.jian', 'nine-dragon-stack.jian'], ['tool.fei-zhua', 'nine-dragon-stack.fei-zhua'],
    ]);
    expect(source.items.rows.find(row => row.kind === 'tool')).toMatchObject({ action: null, hook: null, intensity: 0 });
    expect([source.quests.quests, source.ledger, source.creatures.spawns, source.state.shared, source.state.player]).toEqual([[], [], [], [], []]);
    expect(manifest.species).toEqual([]); expect(manifest.encounters).toEqual([]);
    const data = withoutRuntimeRows(source); expect(data.items.rows).toEqual([]);
    expect(data.props).toBe(source.props); expect(data.entryways).toBe(source.entryways); expect(data.audio).toBe(source.audio);
  });
  it('adopts the prebuilt Jian and original Fei Zhua without adding generic input or replacing native policies', () => {
    const { scope, ctx, primary, grapple } = fixture();
    const bind = vi.spyOn(app.input, 'bind');
    try {
      bindNineItems(ctx, primary, grapple);
      expect(primary.id).toBe('sword'); expect(primary.row.id).toBe('weapon.jian');
      expect(primary.row.legacySlot).toBe(JIAN_ROW.legacySlot); expect(primary.row.meta).toBe(JIAN_ROW.meta);
      expect(primary.row.ui).toEqual({ ...JIAN_ROW.ui, inputContext: 'weapon.melee' });
      expect([primary.row.cues, primary.row.hitStop]).toEqual([JIAN_ROW.cues, JIAN_ROW.hitStop]);
      expect(grapple.row.ui).toEqual(FEI_ZHUA_ROW.ui); expect(grapple.row.meta).toBe(FEI_ZHUA_ROW.meta);
      expect(grapple.id).toBe('tool.fei-zhua'); expect(grapple.actions).toEqual(['lock', 'jump']); expect(grapple.slot).toBe('offhand');
      expect(bind).not.toHaveBeenCalled();
    } finally { scope.dispose(); }
  });
  it('refuses native tool input outside the runtime before construction and refuses it in the lamp family', () => {
    const runtime = vi.fn(() => { throw new Error('Must not construct'); });
    const ports = legacyDouble<DeclaredItemPorts>({ contexts: 'install', runtime });
    expect(() => installDeclaredItems(source.items, ports)).toThrow('runtime-owned'); expect(runtime).not.toHaveBeenCalled();
    const family = declaredKitItemFamilies().get('kit.lantern'), spec = source.items.rows.find(row => row.kind === 'tool');
    if (family?.kind !== 'tool' || spec?.kind !== 'tool') throw new Error('Missing native tool fixture');
    expect(() => family.create(FEI_ZHUA_ROW, spec, legacyDouble<ItemFamilyPorts>({}))).toThrow('toggle action');
  });
  it('C26 keeps a current fragment save byte-for-byte and the original held identity over reload', () => {
    const key = `${appIdentity().savePrefix}nine-dragon-stack`;
    // The shipping fragment has no custom save slots. Preserve generic player metadata without manufacturing migration state.
    const current = JSON.stringify({ keys: { progress: { v: 1, data: { counts: {}, earned: [], title: '', playS: 123 } } } });
    localStorage.setItem(key, current);
    for (let visit = 0; visit < 2; visit++) {
      const { scope, ctx, primary, grapple } = fixture();
      try { bindNineItems(ctx, primary, grapple); expect(primary.id).toBe('sword'); expect(grapple.id).toBe('tool.fei-zhua'); }
      finally { scope.dispose(); }
      expect(localStorage.getItem(key)).toBe(current);
    }
  });
});
