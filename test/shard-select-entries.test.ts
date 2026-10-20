// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { setDev } from '../src/engine/core/devMode';
import { authoredRows } from '../src/engine/ui/authoredDebugRows';
import { installShards } from '../src/game/shard/list';
import { shardEntry, type ShardEntryChoices } from '../src/game/shard/entryMode';
import { buildTitleDeck, type TitleCard } from '../src/game/titleDeck';
import { GAME_STRINGS } from '../src/game/strings';

// G531: SHARD SELECT shows one entry per shard, its shardfile; the Developer-tools row Legacy shard buttons brings LEGACY back.
const card = (slug: TitleCard['slug'], legacy: boolean): TitleCard => ({ slug, name: slug, label: slug, thumbnail: '', heroPortrait: '', heroLandscape: '',
  entries: { legacy, shardfile: true } });
const CARDS = [card('driftwood-isle', true), card('pine-hollow', true), card('far-reach', false)];

function deck(): { root: HTMLElement; select: (i: number) => void; entered: [string, string][] } {
  installShards([]);
  const entered: [string, string][] = [];
  const built = buildTitleDeck({ cards: CARDS, active: null, onEnter: (c, entry) => { entered.push([c.slug, entry]); }, onExplore: () => undefined, onSettings: () => undefined,
    mode: () => ({ developer: true, devserver: true }) });
  document.body.append(built.root);
  return { root: built.root, select: (i) => { built.select(i, false); }, entered };
}
/** the entry buttons a player can see on the selected card */
const shown = (root: HTMLElement): string[] => [...root.querySelectorAll<HTMLButtonElement>('.ws-menu-modes button')]
  .filter((button) => button.hidden === false).map((button) => button.querySelector('b')?.textContent ?? '');
const row = (): { set: (v: string) => void; purpose?: 'developer' } => {
  const found = [...authoredRows].find((r) => r.id === 'legacyShardButtons');
  if (found === undefined) throw new Error('missing Legacy shard buttons row');
  return found;
};
const play = (root: HTMLElement): void => { root.querySelector<HTMLButtonElement>('.ws-menu-play')?.click(); };

afterEach(() => { setDev(false); document.body.replaceChildren(); vi.unstubAllGlobals(); });

test('row off (the default): every card shows only ENTER WORLD and enters its shardfile, in Developer too', () => {
  setDev(true);
  const d = deck();
  expect(row().purpose).toBe('developer');
  CARDS.forEach((_, i) => {
    d.select(i);
    expect(shown(d.root)).toEqual(['Enter world']);
    play(d.root);
  });
  expect(d.entered).toEqual(CARDS.map((c) => [c.slug, 'shardfile']));
});

test('row on in Developer: LEGACY and SHARDFILE come back, and LEGACY enters the legacy copy', () => {
  setDev(true);
  const d = deck();
  row().set('on');
  CARDS.forEach((c, i) => {
    d.select(i);
    expect(shown(d.root)).toEqual([GAME_STRINGS.entry.legacy, GAME_STRINGS.entry.shardfile]);
    expect(d.root.querySelector<HTMLButtonElement>('.ws-menu-play')?.disabled).toBe(!(c.entries?.legacy ?? false));
  });
  d.select(0); play(d.root);
  expect(d.entered).toEqual([['driftwood-isle', 'legacy']]);
  row().set('off');
  expect(shown(d.root)).toEqual(['Enter world']);
});

test('the public build ignores the row: one button, the shardfile', () => {
  setDev(true); const d = deck(); row().set('on'); setDev(false);
  row().set('off'); // ignored outside Developer: the saved pick waits
  d.select(1);
  expect(shown(d.root)).toEqual(['Enter world']);
  setDev(true); d.select(0);
  expect(shown(d.root)).toEqual([GAME_STRINGS.entry.legacy, GAME_STRINGS.entry.shardfile]);
});

test('the boot honours a LEGACY pick only with the legacy buttons on', () => {
  const choices: ShardEntryChoices = { choose: () => undefined, read: () => 'legacy' };
  const pine = { slug: 'pine-hollow', entries: { legacy: true, shardfile: true } } as const;
  expect(shardEntry(pine, false, () => choices)).toBe('shardfile');
  expect(shardEntry(pine, true, () => choices)).toBe('legacy');
  expect(shardEntry({ slug: 'pine-hollow-legacy', entries: { legacy: true, shardfile: false, public: 'legacy' } }, false, () => choices)).toBe('legacy');
});
