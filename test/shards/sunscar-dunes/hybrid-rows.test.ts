import { describe, expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { Flags } from '../../../src/engine/world/interact/flags';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import type { ItemFamily } from '../../../src/engine/combat/itemFamilies';
import type { GameServices } from '../../../src/game/shard/context';
import { Ledger } from '../../../src/game/ledger';
import { bindRuntimeCoins, runtimeSpawnRows, bindRuntimeItems, bindRuntimeLedger, bindRuntimeQuest, withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import { purseSave, shardSave } from '../../../src/game/saves';
import { RESPAWN } from '../../../src/shards/sunscar-dunes/data/spawns';
import { parseShardfile } from '../../../src/game/shardfile/schema';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { Bullwhip, CRACK } from '../../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { WHIP_ROW, whipIcon } from '../../../src/shards/sunscar-dunes/weapons/rows';
import { COMPLETE_FLAG, FACT, LATER_FLAGS } from '../../../src/shards/sunscar-dunes/quests/signal';

const services = (): { app: App; game: GameServices } => ({ app: new App(), game: { shard: manifest, rows: new Map(), bag: new TabRegistry() } });
const whipFamily = (app: App): ReadonlyMap<string, ItemFamily> => new Map([['sunscar-dunes.whip', { kind: 'weapon', create: () => new Bullwhip(app) }]]);

describe('Signal Dunes declares runtime-bound rows (SHARD-PLATFORM M3, the runtime-owner binding)', () => {
  it('declares its quest, ledger and whip in shard.config.ts as sections its trusted runtime binds', () => {
    expect(source.runtime?.binds).toEqual(['quests', 'ledger', 'items', 'spawns', 'terrain']);
    expect(source.quests.quests.map((quest) => quest.id)).toEqual(['sunscar.signal']);
    expect(source.ledger.map((rule) => rule.fact)).toEqual([FACT.signal, FACT.matriarch]);
    expect(source.items.rows.map((row) => [row.id, row.family])).toEqual([['weapon.sunscar-whip', 'sunscar-dunes.whip']]);
    // the data client sees the shardfile as the empty audio / edge transition it was: it installs none of a bound section
    const data = withoutRuntimeRows(source);
    expect([data.quests.quests.length, data.quests.flags.length, data.ledger.length, data.items.rows.length, data.items.contexts.length]).toEqual([0, 0, 0, 0, 0]);
    expect(data.audio).toBe(source.audio); expect(data.edge).toBe(source.edge);
    // G227: the compiled terrain tiles are bound too; the data client sees no terrain, tile, file or critical row
    expect([data.terrain, data.tiles.length, data.files.length, data.critical.length]).toEqual([null, 0, 0, 0]);
  });
  it('the whip row drives the bullwhip and its equipment row: the same numbers, slot and context as before', () => {
    expect([CRACK.reach, CRACK.heavyReach, CRACK.width, CRACK.light, CRACK.heavy, CRACK.cooldown, CRACK.heavyCooldown, CRACK.charge]).toEqual([7, 8, 0.9, 18, 16, 0.45, 0.9, 0.6]);
    expect([WHIP_ROW.id, WHIP_ROW.legacySlot, WHIP_ROW.ui.inputContext, WHIP_ROW.ui.name]).toEqual(['weapon.sunscar-whip', 'sunscar-whip', 'sunscar.whip', 'Bullwhip']);
  });
  it('installs the whip through the declared-items installer with the runtime family, refusing foreign or missing families', () => {
    const { app, game } = services(), ctx = { app, game, scope: app.engineScope };
    try {
      const items = bindRuntimeItems(ctx, source, { icon: whipIcon, families: whipFamily(app) });
      expect(items.primary).toBeInstanceOf(Bullwhip); expect(items.primary?.id).toBe('sunscar-whip');
      expect([...items.runtimes.keys()]).toEqual(['weapon.sunscar-whip']);
      // the context is the runtime's to register (entered-only for a retained home), never the installer's
      expect(() => { app.input.push('sunscar.whip', app.engineScope); }).toThrow('Unknown input context');
      expect(() => bindRuntimeItems(ctx, source, { icon: whipIcon, families: new Map([['other.whip', { kind: 'weapon', create: () => new Bullwhip(app) }]]) })).toThrow('must be named sunscar-dunes.<name>');
      expect(() => bindRuntimeItems(ctx, source, { icon: whipIcon, families: new Map() })).toThrow('Unresolved item family sunscar-dunes.whip');
      expect(() => bindRuntimeItems(ctx, source, { icon: whipIcon, kit: whipFamily(app), families: whipFamily(app) })).toThrow('shadows a registered family');
    } finally { app.engineScope.dispose(); }
  });
  it('refuses a section the runtime does not declare it binds', () => {
    const { app } = services(), runtime = source.runtime;
    if (runtime === null) throw new Error('Signal Dunes declares its runtime');
    const { spawns, ...rest } = runtime;
    const unbound = parseShardfile({ ...source, runtime: { ...rest, binds: ['items'] } });
    expect(() => parseShardfile({ ...source, runtime: { ...rest, spawns, binds: ['items'] } })).toThrow(); // rows the runtime does not bind
    expect(() => parseShardfile({ ...source, runtime: { ...rest, binds: ['items', 'spawns'] } })).toThrow(); // a bind with no rows
    try {
      expect(() => bindRuntimeLedger({ app }, unbound, 'sunscar-dunes')).toThrow('not bound by its runtime');
      expect(() => bindRuntimeQuest({ app, scope: app.engineScope }, unbound, 'sunscar.signal', { flags: new Flags('sunscar-dunes') })).toThrow('not bound by its runtime');
      expect(() => runtimeSpawnRows(unbound)).toThrow('not bound by its runtime');
      expect(() => parseShardfile({ ...source, runtime: { ...runtime, binds: ['quests', 'quests'] } })).toThrow();
    } finally { app.engineScope.dispose(); }
  });
  it('binds the declared quest over the runtime flags and grants its fact once across a rebind', () => {
    localStorage.clear();
    const { app } = services(), flags = new Flags('sunscar-dunes'), scope = app.engineScope;
    try {
      const facts = bindRuntimeLedger({ app }, source, 'sunscar-dunes');
      const quest = bindRuntimeQuest({ app, scope }, source, 'sunscar.signal', { flags, facts });
      expect([quest.reward.coins, quest.reward.fact, quest.state.isComplete]).toEqual([5, FACT.signal, false]);
      for (const flag of LATER_FLAGS) flags.set(flag);
      app.events.flush('update'); expect(flags.has(COMPLETE_FLAG)).toBe(true);
      const ledger = new Ledger(app.saves, [{ id: 'sunscar-dunes', shard: 'sunscar-dunes' }], [{ shard: 'sunscar-dunes', revision: source.identity.revision, rules: source.ledger }], []);
      const earned = (): boolean[] => Object.values(ledger.state().achievements).filter((a) => a.shard === 'sunscar-dunes').map((a) => a.earned);
      expect(earned()).toEqual([true]);
      const facts2 = bindRuntimeLedger({ app }, source, 'sunscar-dunes');
      expect(bindRuntimeQuest({ app, scope }, source, 'sunscar.signal', { flags, facts: facts2 }).state.isComplete).toBe(true);
      expect(earned()).toEqual([true]);
    } finally { scope.dispose(); }
  });
  it('declares the creatures as runtime spawn rows: thirteen homes under their authored identities, and the Matriarch body', () => {
    const rows = source.runtime?.spawns; if (rows === undefined) throw new Error('Signal Dunes declares runtime.spawns');
    expect(rows.homes.map((row) => row.id)).toEqual(Array.from({ length: 13 }, (_, i) => `sunscar.home:${String(i)}`));
    expect(rows.homes.map((row) => row.kind)).toEqual(['duneRay', ...Array.from({ length: 10 }, () => 'sandSkitterer'), 'duneStrider', 'duneStrider']);
    expect(rows.homes.map((row) => row.respawn)).toEqual([RESPAWN.duneRay, ...Array.from({ length: 10 }, () => RESPAWN.sandSkitterer), RESPAWN.duneStrider, RESPAWN.duneStrider]);
    expect(rows.bosses).toEqual([{ id: 'sunscar.matriarch', kind: 'duneMatriarch', look: 'matriarch', at: [-14, -150], yaw: 0 }]);
    // the data client has nothing to install for them: they are the runtime's, not the local sim's creatures section
    expect(withoutRuntimeRows(source).creatures.spawns).toEqual([]);
  });
  it('pays runtime coins through the platform purse, never a direct save write (headless: the shard purse)', () => {
    localStorage.clear();
    const pay = bindRuntimeCoins({ manifest }, null), purse = shardSave(purseSave, manifest.slug);
    pay(3); pay(2); expect(purse.read()).toBe(5);
  });
});
