/**
 * E314: every shard's BAG tabs (src/game/bag/bag.ts `bagTabs`, read by src/engine/ui/Menu.ts syncTabs) — Driftwood's five, Pine
 * Hollow's five (its journal is its FINDS, pick C), Nalati's four (no PACK, pick C), Nine Dragon's MAP · GEAR (pick A) —
 * and Nine Dragon's GEAR: the Neon Jian by name, the Fei Zhua as a card, no iron sword anywhere in its kit.
 */
import { describe, expect, it } from 'vitest';
import { bagTabs } from '#game/bag/bag';
import { icon } from '#engine/ui/icons';
import { Inventory } from '#game/Inventory';
import { Progress } from '#game/Progress';
import { FEI_ZHUA, NINE_WEAPON_NAME } from '#shards/nine-dragon-stack/bag';
import { ROSTER as NINE_ROSTER } from '#shards/nine-dragon-stack/roster';

const DRIFT = 'chunk://local/driftwood-isle', PINE = 'chunk://local/pine-hollow', NALATI = 'chunk://local/nalati-grasslands', NINE = 'chunk://local/nine-dragon-stack';
/** which shards install a FINDS view at boot: Driftwood's loot (src/game/loot/install.ts), Pine Hollow's hunter's journal
 *  (src/game/compendium/install.ts), Nalati's elites + places (src/shards/nalati-grasslands/bag.ts); Nine Dragon none */
const FINDS: Record<string, boolean> = { [DRIFT]: true, [PINE]: true, [NALATI]: true, [NINE]: false };
const tabsOf = (id: string): string[] => bagTabs({ finds: FINDS[id] ?? false, pack: new Inventory(id).slots > 0, feats: new Progress(id).rows.length > 0 });

describe('each shard\'s BAG tabs', () => {
  it('Driftwood: MAP · GEAR · FINDS · PACK · FEATS', () => {
    expect(tabsOf(DRIFT)).toEqual(['map', 'gear', 'finds', 'inventory', 'achievements']);
  });
  it('Pine Hollow: MAP · GEAR · FINDS · PACK · FEATS (its journal is FINDS)', () => {
    expect(tabsOf(PINE)).toEqual(['map', 'gear', 'finds', 'inventory', 'achievements']);
  });
  it('Nalati: MAP · GEAR · FINDS · FEATS (no pack)', () => {
    expect(tabsOf(NALATI)).toEqual(['map', 'gear', 'finds', 'achievements']);
  });
  it('Nine Dragon: MAP · GEAR (no pack, no feats)', () => {
    expect(new Inventory(NINE).slots).toBe(0);
    expect(new Progress(NINE).rows).toHaveLength(0);
    expect(tabsOf(NINE)).toEqual(['map', 'gear']);
  });
  it('nothing enters a Nine Dragon pack', () => {
    const inv = new Inventory(NINE);
    expect(inv.add('crab-claw')).toBe(false);
    expect(inv.items).toHaveLength(0);
  });
});

describe('Nine Dragon\'s GEAR', () => {
  it('the jian is named, the grapple is a card with its own glyph', () => {
    expect(NINE_WEAPON_NAME).toBe('Neon Jian');
    expect(FEI_ZHUA).toMatchObject({ name: 'Fei Zhua', kind: 'Grapple' });
    expect(icon(FEI_ZHUA.icon)).toContain('<path');
  });
  it('the Explorer\'s gear cards are the jian arms alone (no iron sword)', () => {
    const ids = NINE_ROSTER.map((e) => e.id);
    expect(ids).toContain('nine-dragon-stack/fp-arms');
    expect(ids).not.toContain('shared/iron-sword');
  });
});
