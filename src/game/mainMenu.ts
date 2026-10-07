/**
 * The Wildshard main menu (SHARD-PLATFORM SF21a; Jake's picks G79 / G88, board `art/menu/round-7-new-main-menu/B-*`):
 * a first-person crossroads hero, the WILDSHARD logo, two big side-by-side cards SHARD SELECT and INFINITE WILDSHARD,
 * and SETTINGS. With Developer off INFINITE WILDSHARD is hidden until SF22's gates pass (G63), and SHARD SELECT is one
 * wide card. SHARD SELECT opens today's shard deck (src/game/titleDeck.ts), unchanged (G58 / G64): the deck sits under the
 * menu, laid out (so its carousel centres), and a MAIN MENU button beside its SETTINGS comes back.
 *
 *   const view = buildTitleMenu({ ...deck options, onGrid })   // a TitleDeckView: the cold title and pause ▸ EXIT TO MAIN
 *
 * Both ways in (src/entry.ts's cold title and the HUD's showIntro, wired in src/game/session/loadout.ts) build it, so the
 * main menu is the first screen either way. A rebuild (Settings ▸ Developer flips it) keeps the screen it was on.
 * With Developer on, the day's WHAT'S NEW banner sits under the logo (SF60 / G214, src/game/whatsNewBanner.ts).
 */
import { lastEnd } from '@wildshard/engine/boot/lastEnd';
import { buildTitleDeck, titleCards, type TitleDeck, type TitleDeckOptions } from './titleDeck';
import { gridEntryShown, menuMode } from './grid/menu';
import { dropGridIntent, enterGrid } from './grid/boot';
import { gridRecoveryLoop } from './grid/recoveryBoot';
import { installGridDebug } from './grid/debug';
import { GAME_STRINGS } from './strings';
import { WHATS_NEW, type WhatsNew } from './whatsNew';
import { buildWhatsNewBanner, type HiddenStore } from './whatsNewBanner';
import './mainMenu.css';

/** the hero: Jake's picked crossroads (G88), painted from the grid's real boulevard capture (SF17b), no UI baked in */
export const MAIN_MENU_HERO = '/assets/title/main-crossroads-portrait.jpg';

const CARDS_ICON = '<svg viewBox="0 0 64 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="6" y="11" width="18" height="27" rx="2" transform="rotate(-16 15 24)"/><rect x="40" y="11" width="18" height="27" rx="2" transform="rotate(16 49 24)"/><rect x="22" y="4" width="20" height="31" rx="2" fill="rgba(6,10,18,0.85)"/></g></svg>';
const GRID_CELLS = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `<rect x="${17 + c * 11}" y="${6 + r * 13}" width="8" height="9" rx="1"/>`)).join('');
const GRID_DOTS = [10, 24, 38].flatMap((y) => [`<circle cx="9" cy="${y + 1}" r="1.4"/>`, `<circle cx="55" cy="${y + 1}" r="1.4"/>`]).join('');
const GRID_ICON = `<svg viewBox="0 0 64 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">${GRID_CELLS}</g><g fill="currentColor">${GRID_DOTS}</g></svg>`;

export type MainMenuScreen = 'main' | 'select';
/** the screen this page's title is on: a rebuild (Developer flipped in Settings) comes back to it */
let screen: MainMenuScreen = 'main';

export interface TitleMenuOptions extends Omit<TitleDeckOptions, 'cards'> {
  /** the deck's cards (default: `titleCards()`, Developer read live) */
  readonly cards?: TitleDeckOptions['cards'];
  /** INFINITE WILDSHARD's tap: boots the grid from its one-shot intent (src/game/grid/boot.ts `enterGrid`) */
  readonly onGrid: () => void;
  /** which screen to open on (default: the one this page was last on, the main menu at first) */
  readonly screen?: MainMenuScreen;
  /** SF60 / G214: the WHAT'S NEW banner's lines (default: today's, src/game/whatsNew.ts) and its hide store (tests) */
  readonly whatsNew?: WhatsNew;
  readonly whatsNewStore?: HiddenStore;
}

/** the title deck's view with the main menu over it (the HUD's TitleDeckView: keys, refresh, enter) */
export interface TitleMenu {
  readonly root: HTMLElement;
  readonly cards: TitleDeck['cards'];
  readonly index: number;
  readonly select: (i: number, smooth?: boolean) => void;
  readonly activate: () => void;
  readonly start: () => void;
  readonly dispose: () => void;
  /** the screen on show (tests, the proof script) */
  readonly screen: MainMenuScreen;
  readonly show: (next: MainMenuScreen) => void;
}

function required<T extends HTMLElement>(root: ParentNode, selector: string, type: new () => T): T {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`Main menu: missing ${selector}`);
  return found;
}

export function buildTitleMenu(opts: TitleMenuOptions): TitleMenu {
  const mode = opts.mode ?? menuMode;
  const { notice, onGrid, screen: first, cards = titleCards(), whatsNew = WHATS_NEW, whatsNewStore, ...deckOpts } = opts;
  // leaving the title for a world resets it: pause ▸ EXIT TO MAIN opens on the main menu again
  const deck = buildTitleDeck({ ...deckOpts, cards,
    onEnter: (card) => { screen = 'main'; deckOpts.onEnter(card); },
    onExplore: (card) => { screen = 'main'; deckOpts.onExplore(card); } });
  const grid = gridEntryShown(mode());
  const s = GAME_STRINGS.mainMenu;

  const root = document.createElement('div');
  root.className = 'ws-title-stack';
  const main = document.createElement('div');
  main.className = 'ws-main';
  main.innerHTML = `
    <div class="ws-main-hero"></div>
    <div class="ws-main-head"><div class="ws-main-logo">${s.logo}</div></div>
    <div class="ws-main-foot">
      <div class="ws-main-cards${grid ? '' : ' one'}" role="group" aria-label="${s.label}">
        <button class="ws-main-card ws-main-select" type="button"><span class="ws-main-icon">${CARDS_ICON}</span><b>${s.shardSelect}</b></button>
        ${grid ? `<button class="ws-main-card ws-main-grid" type="button"><span class="ws-main-icon">${GRID_ICON}</span><b>${s.infinite}</b></button>` : ''}
      </div>
      <button class="ws-main-settings" type="button">${s.settings}</button>
    </div>`;
  required(main, '.ws-main-hero', HTMLElement).style.backgroundImage = `url('${MAIN_MENU_HERO}')`;
  if (notice !== undefined && notice !== '') {
    const line = document.createElement('div');
    line.className = 'ws-main-notice';
    line.setAttribute('role', 'status');
    line.textContent = notice;
    required(main, '.ws-main-head', HTMLElement).append(line);
  }
  // SF60 / G214 (Jake: B, a slim banner under the logo): Developer on and the day's lines; folded it is one line
  const banner = buildWhatsNewBanner({ news: whatsNew, developer: mode().developer, onTap: deck.onTap,
    ...(whatsNewStore === undefined ? {} : { store: whatsNewStore }) });
  if (banner !== null) required(main, '.ws-main-logo', HTMLElement).after(banner.root);
  // G106 (Jake: "A Carousel restyled"): SHARD SELECT is today's deck, same path and behaviour (G64), restyled to the menu:
  // BACK and the SHARD SELECT title on top, the crossroads hero dimmed behind, one big card, a thumbnail strip for the dots
  // (DEVELOPER tags, a COMING SOON lock) and a wide ENTER WORLD (src/game/mainMenu.css `.ws-menu-carousel`)
  deck.root.classList.add('ws-menu-carousel');
  const bar = document.createElement('div');
  bar.className = 'ws-menu-bar';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'ws-menu-back';
  back.textContent = s.back;
  const title = document.createElement('div');
  title.className = 'ws-menu-title';
  title.textContent = s.shardSelect;
  bar.append(back, title);
  deck.root.querySelector('.ws-menu-head')?.prepend(bar);
  root.append(deck.root, main);

  const selectCard = required(main, '.ws-main-select', HTMLButtonElement);
  const show = (next: MainMenuScreen): void => {
    screen = next;
    root.dataset['screen'] = next;
    main.classList.toggle('hide', next !== 'main');
    deck.root.classList.toggle('hide', next !== 'select');
    main.inert = next !== 'main';
    deck.root.inert = next !== 'select';
    if (next === 'main') selectCard.focus({ preventScroll: true });
  };
  deck.onTap(selectCard, () => { show('select'); deck.start(); });
  const gridCard = main.querySelector('.ws-main-grid');
  if (gridCard instanceof HTMLButtonElement) deck.onTap(gridCard, () => { if (gridEntryShown(mode())) onGrid(); });
  deck.onTap(required(main, '.ws-main-settings', HTMLButtonElement), () => { opts.onSettings(); });
  deck.onTap(back, () => { show('main'); });
  show(first ?? screen);

  return {
    root, cards: deck.cards,
    get index() { return deck.index; },
    get screen() { return screen; },
    show,
    // the HUD's arrow keys move the deck; on the main menu they wait for SHARD SELECT
    select: (i, smooth) => { deck.select(i, smooth); },
    // the HUD's confirm / any key: the main menu's first card opens the deck, the deck enters its card
    activate: () => { if (screen === 'main') { show('select'); deck.start(); } else deck.activate(); },
    start: () => { deck.start(); if (screen === 'main') selectCard.focus({ preventScroll: true }); },
    dispose: () => { deck.dispose(); },
  };
}

/**
 * The cold title's Infinite Wildshard wiring (SF21a), one call for the composition root (src/entry.ts):
 *   - a stale one-shot intent is consumed here, so nothing but a new tap boots the grid (R3-C5);
 *   - the DEVSERVER cell's Debug row is installed (a DEVSERVER build only);
 *   - when the previous page was the grid and it ended unexpectedly (iOS's memory kill), the title only adds one line.
 */
export interface GridTitle { readonly onGrid: () => void; readonly note: string; readonly screen?: MainMenuScreen }
export function installGridTitle(): GridTitle {
  dropGridIntent();
  installGridDebug();
  const end = lastEnd();
  const loop = gridRecoveryLoop();
  return { onGrid: enterGrid, note: loop || (end.kind === 'unexpected' && end.mode === 'grid') ? GAME_STRINGS.grid.ended : '',
    ...(loop ? { screen: 'select' } : {}) };
}
