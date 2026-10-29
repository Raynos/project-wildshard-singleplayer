// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { setDev } from '../src/engine/core/devMode';
import { authoredRows } from '../src/engine/ui/authoredDebugRows';
import { shardEntryManifest } from '../src/game/shard/legacy';
import type { ShardManifest } from '../src/game/shard/manifest';
import { installShards, shards } from '../src/game/shard/list';
import { shardEntry, type ShardEntryChoices } from '../src/game/shard/entryMode';
import { buildTitleDeck, titleCards, type TitleCard } from '../src/game/titleDeck';
import { GAME_STRINGS } from '../src/game/strings';
import { SHARDS, LEGACY_SHARDS } from '../src/shards.generated';
import plots from '../src/shards/open-plots/outputs.json' with { type: 'json' };

// G531: SHARD SELECT shows one entry per shard, its shardfile; the Developer-tools row Legacy shard buttons brings LEGACY back.
const card = (slug: TitleCard['slug'], legacy: boolean): TitleCard => ({ slug, name: slug, label: slug, thumbnail: '', heroPortrait: '', heroLandscape: '',
  entries: { legacy, shardfile: true } });
const CARDS = [card('driftwood-isle', true), card('pine-hollow', true), card('far-reach', false)];
const decks: ReturnType<typeof buildTitleDeck>[] = [];
const paintFrames = (): Promise<void> => new Promise(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); });

function deck(): { root: HTMLElement; select: (i: number) => void; entered: [string, string][] } {
  installShards([]);
  const entered: [string, string][] = [];
  const built = buildTitleDeck({ cards: CARDS, active: null, onEnter: (c, entry) => { entered.push([c.slug, entry]); }, onExplore: () => undefined, onSettings: () => undefined,
    mode: () => ({ developer: true, devserver: true }) });
  decks.push(built);
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

afterEach(() => { for (const built of decks.splice(0)) built.dispose(); setDev(false); document.body.replaceChildren(); vi.unstubAllGlobals(); });

test('row off (the default): every card shows only ENTER WORLD and enters its shardfile, in Developer too', async () => {
  setDev(true);
  const d = deck();
  expect(row().purpose).toBe('developer');
  for (const [i, c] of CARDS.entries()) {
    const visit = i === 0 ? d : deck(); visit.select(i);
    expect(shown(visit.root)).toEqual(['Enter world']);
    play(visit.root);
    expect(visit.entered).toEqual([]);
    expect(document.querySelector('[data-navigation] [data-el="slug"]')?.textContent).toBe(c.name);
    await paintFrames();
    expect(visit.entered).toEqual([[c.slug, 'shardfile']]);
    decks.at(-1)?.dispose();
  }
});

test('row on in Developer: LEGACY and SHARDFILE come back where a legacy copy is left, and LEGACY enters it', async () => {
  setDev(true);
  const d = deck();
  row().set('on');
  CARDS.forEach((c, i) => {
    d.select(i);
    // a card whose legacy copy is retired (LD6 / LD7) keeps the one ENTER WORLD
    expect(shown(d.root)).toEqual(c.entries?.legacy === true ? [GAME_STRINGS.entry.legacy, GAME_STRINGS.entry.shardfile] : ['Enter world']);
    expect(d.root.querySelector<HTMLButtonElement>('.ws-menu-play')?.disabled).toBe(false);
  });
  d.select(0); play(d.root);
  expect(d.entered).toEqual([]);
  await paintFrames();
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


test('SHARD SELECT shows only experimental Night Market among open plots and retains the full grid catalogue', () => {
  installShards([...SHARDS, ...LEGACY_SHARDS]);
  const main = ['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'nine-dragon-stack', 'sunscar-dunes', 'far-reach', 'open-plot-night-market'];
  const developer = [...main, '_template', 'blender-template', 'pastel-plain', 'ink-cel-valley'];
  expect(titleCards(false).map(item => item.slug).sort()).toEqual(main.sort());
  expect(titleCards(true).map(item => item.slug).sort()).toEqual(developer.sort());
  const plotSlugs = new Set(plots.outputs.map(item => item.slug));
  expect(plotSlugs.size).toBe(14);
  for (const developerMode of [false, true]) {
    expect(titleCards(developerMode).filter(item => plotSlugs.has(item.slug)).map(item => [item.slug, item.badge]))
      .toEqual([['open-plot-night-market', 'Experimental']]);
  }
  const hidden = SHARDS.filter(item => plotSlugs.has(item.slug) && item.slug !== 'open-plot-night-market');
  expect(hidden).toHaveLength(13);
  for (const manifest of hidden) expect(manifest).toMatchObject({ status: 'hidden', shardSelect: false });
  expect(SHARDS.find(item => item.slug === 'open-plot-night-market')).toMatchObject({ status: 'experimental', shardSelect: true });
  expect(SHARDS.filter(item => plotSlugs.has(item.slug)).map(item => item.slug).sort()).toEqual([...plotSlugs].sort());
  expect(shards()).toHaveLength(SHARDS.length + LEGACY_SHARDS.length);
  installShards([]);
});

test('the backdrop is the hero over the card\'s own thumbnail, so a late hero never leaves it black', () => {
  installShards([]);
  const art = (slug: TitleCard['slug']): TitleCard => Object.assign(card(slug, true), { thumbnail: `/thumbs/${slug}.jpg`, heroPortrait: `/heroes/${slug}-portrait.jpg`, heroLandscape: `/heroes/${slug}-landscape.jpg` });
  const cards = [art('driftwood-isle'), art('pine-hollow')];
  const built = buildTitleDeck({ cards, active: null, onEnter: () => undefined, onExplore: () => undefined, onSettings: () => undefined, mode: () => ({ developer: true, devserver: true }) });
  document.body.append(built.root);
  vi.stubGlobal('innerWidth', 402); vi.stubGlobal('innerHeight', 874);
  built.select(1, false);
  const hero = built.root.querySelector<HTMLElement>('.ws-menu-hero');
  expect(hero?.style.backgroundImage.replaceAll('"', "'")).toBe("url('/heroes/pine-hollow-portrait.jpg'), url('/thumbs/pine-hollow.jpg')");
});


test('Settings responds on pointerup once, keeps keyboard click, and retires its listeners', () => {
  const settings = vi.fn<() => void>();
  const built = buildTitleDeck({ cards: CARDS, active: null, onEnter: () => undefined,
    onExplore: () => undefined, onSettings: settings, mode: () => ({ developer: true, devserver: true }) });
  const button = built.root.querySelector<HTMLButtonElement>('.ws-menu-settings');
  if (button === null) throw new Error('missing Settings');
  button.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }));
  expect(settings).toHaveBeenCalledTimes(1);
  button.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true }));
  expect(settings).toHaveBeenCalledTimes(1);
  button.click(); // Keyboard and assistive-technology clicks have no pointer detail.
  expect(settings).toHaveBeenCalledTimes(2);
  built.dispose();
  button.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  button.click();
  expect(settings).toHaveBeenCalledTimes(2);
});

test('shared title actions toggle once per tap and disabled entry buttons stay inert', async () => {
  const entered = vi.fn<() => void>(), toggled = vi.fn<() => void>();
  const built = buildTitleDeck({ cards: CARDS, active: null, onEnter: entered,
    onExplore: () => undefined, onSettings: () => undefined, mode: () => ({ developer: true, devserver: true }) });
  const toggle = document.createElement('button');
  built.onTap(toggle, toggled);
  toggle.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  toggle.dispatchEvent(new MouseEvent('click', { detail: 1 }));
  expect(toggled).toHaveBeenCalledTimes(1);
  toggle.dispatchEvent(new PointerEvent('pointerup', { button: 2 }));
  expect(toggled).toHaveBeenCalledTimes(1);
  const playButton = built.root.querySelector<HTMLButtonElement>('.ws-menu-play');
  if (playButton === null) throw new Error('missing entry button');
  playButton.disabled = true;
  playButton.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  expect(entered).not.toHaveBeenCalled();
  playButton.disabled = false;
  playButton.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  playButton.dispatchEvent(new MouseEvent('click', { detail: 1 }));
  expect(entered).not.toHaveBeenCalled();
  await paintFrames();
  expect(entered).toHaveBeenCalledTimes(1);
  built.dispose();
});

test('every retained Legacy button resolves and boots its original plugin and look modules', async () => {
  const manifests = [...SHARDS, ...LEGACY_SHARDS];
  installShards(manifests); setDev(true);
  const cards = titleCards(true), selected: ShardManifest[] = [];
  const makeDeck = (): ReturnType<typeof buildTitleDeck> => buildTitleDeck({ cards, active: null, onEnter: (choice, mode) => {
    const manifest = shardEntryManifest(manifests, choice.slug, mode ?? 'legacy');
    if (manifest === undefined) throw new Error('Missing selected manifest');
    selected.push(manifest);
  }, onExplore: () => undefined, onSettings: () => undefined, mode: () => ({ developer: true, devserver: true }) });
  let built = makeDeck();
  document.body.append(built.root);
  const option = [...authoredRows].find(optionRow => optionRow.id === 'legacyShardButtons');
  if (option === undefined) throw new Error('Missing Legacy shard buttons');
  option.set('on');

  try {
    for (const copy of LEGACY_SHARDS) {
      // Each retained entry is a fresh page in production, not a second tap on
      // the already-departing title. Preserve every plugin/look qualification.
      if (selected.length > 0) { built.dispose(); built.root.remove(); built = makeDeck(); document.body.append(built.root); }
      const primary = copy.slug.slice(0, -'-legacy'.length);
      const index = cards.findIndex(choice => choice.slug === primary);
      expect(index, copy.slug).toBeGreaterThanOrEqual(0);
      built.select(index, false);
      const button = built.root.querySelector<HTMLButtonElement>('.ws-menu-play');
      expect(button?.disabled, copy.slug).toBe(false); button?.click();
      await paintFrames();
      expect(selected.at(-1), copy.slug).toBe(copy);
      if (copy.load === undefined || copy.render === undefined) throw new Error('Frozen boot loader missing');
      const loaded = await copy.load();
      const Plugin = loaded.default, plugin = new Plugin();
      expect(typeof plugin.world, copy.slug).toBe('function');
      // Frozen render loaders predate products and consume no arguments.
      const look: unknown = await Reflect.apply(copy.render, undefined, []);
      expect(look, copy.slug).toBeTypeOf('object');
      if (typeof look === 'object' && look !== null) {
        const dispose: unknown = Reflect.get(look, 'dispose');
        if (typeof dispose === 'function') Reflect.apply(dispose, look, []);
      }
    }
    expect(selected).toEqual(LEGACY_SHARDS);
  } finally { built.dispose(); option.set('off'); installShards([]); }
}, 60_000); // Six real lazy plugin/look graphs compile once; no world, renderer or network double.
