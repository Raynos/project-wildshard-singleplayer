import { weaponEffects } from './boot/weaponEffects.generated';
import ecology from './data/ecology.generated.json' with { type: 'json' };
import NALATI_FEATS from './data/feats.json' with { type: 'json' };
/**
 * Nalati's Bag (E314, Jake's pick C, art/loot/round-3-other-shards/board-2-nalati.jpg): MAP · GEAR · FINDS · FEATS. No
 * PACK and no harvest — src/game/Inventory.ts keeps nothing on Nalati, so the menu hides the tab and no carcass shows
 * "[E] Harvest". What this file adds, pure (test/shards/nalati-grasslands/nalati-bag.test.ts):
 *
 *   skinRows(locker)                           GEAR's SKINS row: every skin — owned ones WEAR / WORN, the rest dim (locked)
 *                                              saying who drops them
 *   nalatiFinds(flags)                         FINDS: the 5 named elites (felled = bright, not yet = dashed) each with its
 *                                              prize (the skin, or Argymaq himself, and the title), then the 17 places
 *
 *   menu.setFinds(() => nalatiFinds(adventure.flags));   // main.ts, once the adventure (its saved flags) exists
 */
import type { FindsView } from '@wildshard/game/bag/bag';
import type { IconId } from '@wildshard/engine/ui/icons';
import type { SkinRow } from '@wildshard/engine/ui/Menu';
import content from './data/questContent.json' with { type: 'json' };
import type { CosmeticFinishLocker } from '@wildshard/game/loadout/cosmeticFinishes';

export const NALATI_CHUNK_ID = 'chunk://local/nalati-grasslands';

/** the elites in FINDS' order (the board's), each one's sticker glyph */
export const FINDS_ELITES: readonly { id: string; icon: IconId }[] = [
  { id: 'aqbars', icon: 'leopard' },
  { id: 'kokbori', icon: 'wolf' },
  { id: 'qyran', icon: 'eagle' },
  { id: 'qara-batyr', icon: 'rider' },
  { id: 'argymaq', icon: 'horse' },
];

/** what an elite pays: its skin ("Irbis skin") or, for Argymaq, himself ("Your horse"), and its FEATS title */
export function elitePrize(id: string): { prize: string; title: string | null } {
  const skin = ecology.elites[id]?.drop.skin ?? null;
  const name = skin === null ? null : weaponEffects.skins.find((s) => s.id === skin)?.name ?? null;
  const title = NALATI_FEATS.find((a) => a.id === id)?.title ?? null;
  return { prize: name === null ? 'Your horse' : `${name} skin`, title };
}

/** GEAR's SKINS row: every Nalati skin; the ones not owned yet locked, saying who drops them */
export function skinRows(locker: Pick<CosmeticFinishLocker, 'cardRows' | 'finishes'>): SkinRow[] {
  return locker.cardRows(locker.finishes.cards);
}

/** FINDS: the elites (a `felled:<id>` flag each, src/shards/nalati-grasslands/adventure.ts) and the places (`seen:<id>`) */
export function nalatiFinds(flags: { has: (flag: string) => boolean }): FindsView {
  const elites = FINDS_ELITES.map(({ id, icon }) => {
    const { prize, title } = elitePrize(id);
    return { label: ecology.elites[id]?.name ?? id, icon, found: flags.has(`felled:${id}`), prize: title !== null ? [prize, title] : [prize] };
  });
  const places = content.places.map((p) => ({ label: p.label, icon: 'pin' as const, found: flags.has(`seen:${p.id}`) }));
  return {
    counters: [
      { label: 'Elites', n: elites.filter((e) => e.found).length, of: elites.length },
      { label: 'Places', n: places.filter((p) => p.found).length, of: places.length },
    ],
    next: null,
    sections: [
      { title: 'Elites', wide: true, items: elites },
      { title: 'Places', dense: true, items: places },
    ],
    glass: [],
  };
}
