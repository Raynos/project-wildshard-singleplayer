/**
 * The title screen's shard deck — ONE implementation for both ways in (E318, Jake: "lol wtf why do we have two title
 * screens, one only please"): the cold launch (src/engine/ui/StartTitle.ts, renderer-free, before any shard loads) and pause ▸
 * EXIT TO MAIN (src/engine/ui/HUD.ts `showIntro`, over the loaded shard) build the same deck from the same cards.
 *
 *   const deck = buildTitleDeck({ cards: titleCards(), onEnter, onExplore, onSettings })
 *   parent.append(deck.root); deck.start()                // after it is in the DOM: centre the selected card
 *   deck.select(i) · deck.index · deck.activate()          // the HUD's arrow keys / any key
 *   deck.dispose()                                          // its resize listeners, when the title goes away
 *
 * A horizontal carousel of shard cards over the selected card's hero art (portrait / landscape by the viewport), dots
 * under it, ENTER WORLD and EXPLORE WORLD, and the main menu's SETTINGS. A swipe steps one card; the centred card is the
 * selection. Hero art loads for the selected card only; a neighbour's warms when a swipe or a dot press starts toward it.
 *
 * Cards use the generated, node-safe manifests; world builders remain lazy.
 * test/title-deck.test.ts keeps each card's name, label (the def's `biome`), badge and art equal to its ShardManifest.
 */
import { SHARDS, type ShardSlug } from './shard/shards.generated';
import { setting, onSettingChange } from '#engine';
import { readSummary, summaryView } from './summary';
import { GAME_STRINGS } from './strings';
import './summary.css';

export { travel } from './travel/travel';

export type TitleBadge = 'Early access' | 'Experimental';

/** one shard card. The standalone title art fields are swapped alongside the manifests: src/engine/boot/extras.ts points them at their in-memory copies */
export interface TitleCard {
  readonly slug: ShardSlug;
  readonly name: string;
  /** the one-line player blurb under the name (the def's `biome`; E318: no grid coordinates, no chunk size) */
  readonly label: string;
  badge?: TitleBadge;
  thumbnail: string;
  heroPortrait: string;
  heroLandscape: string;
}

/** Cards are derived at each opening so Debug's hidden-shard pick and preloaded art stay current. */
export function titleCards(showHidden = setting('showHiddenShards') === 'on'): readonly TitleCard[] {
  return SHARDS.filter((m) => showHidden || m.status !== 'hidden').map((m): TitleCard => {
    const card: TitleCard = {
    slug: m.slug, name: m.name, label: m.biome,
    thumbnail: m.card.thumb, heroPortrait: m.card.portrait, heroLandscape: m.card.landscape,
    };
    if (m.status === 'earlyAccess') card.badge = 'Early access';
    if (m.status === 'experimental') card.badge = 'Experimental';
    return card;
  });
}

export interface TitleDeckOptions {
  readonly cards: readonly TitleCard[];
  /** the shard this page is running (its card is LOADED and selected first); null on the cold launch */
  readonly active: string | null;
  readonly onEnter: (card: TitleCard) => void;
  readonly onExplore: (card: TitleCard) => void;
  readonly onSettings: () => void;
  /** a line under the wordmark (the cold launch's "returned to shard select" after an interrupted boot) */
  readonly notice?: string;
}

export interface TitleDeck {
  readonly root: HTMLElement;
  readonly cards: readonly TitleCard[];
  readonly index: number;
  readonly select: (i: number, smooth?: boolean) => void;
  /** ENTER WORLD on the selected card */
  readonly activate: () => void;
  /** centre the selected card: call once the deck is in the DOM (offsets need layout) */
  readonly start: () => void;
  readonly dispose: () => void;
}

const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 3.5L9 14l1 1L20.5 4.5z M6.5 12.5l5 5 M8 14l-4.5 4.5 1 1L9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function required(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Title deck: missing ${selector}`);
  return found;
}

/** ENTER WORLD's small line for a card */
function hintFor(card: TitleCard, active: boolean): string {
  if (!active) return `Loads ${card.name}`;
  return card.badge === 'Early access' ? 'Early access' : card.badge === 'Experimental' ? 'Experimental · rough edges' : 'Play';
}

export function buildTitleDeck(opts: TitleDeckOptions): TitleDeck {
  const { cards } = opts;
  const activeIndex = cards.map((card): string => card.slug).indexOf(opts.active ?? '');
  const root = document.createElement('div');
  root.className = 'ws-menu';
  root.innerHTML = `
    <div class="ws-menu-hero"></div>
    <div class="ws-menu-head"><div class="ws-wordmark">Project <b>Wildshard</b></div>
      <button class="ws-menu-mode ws-menu-explore" type="button"><span class="ws-menu-mode-glyph">${EYE}</span><span class="ws-menu-explore-text"><b>Explore world</b><small>Fly · inspect</small></span></button></div>
    <div class="ws-menu-deck">
      <div class="ws-menu-cards"><div class="ws-menu-deck-track">${cards.map((c, i) => {
        const active = i === activeIndex;
        return `
        <button class="ws-menu-card${active ? ' active' : ''}" type="button" data-i="${i}">
          <span class="ws-menu-card-img" style="background-image:url('${c.thumbnail}')"><i class="ws-menu-card-tag${active ? ' ok' : ''}">${active ? 'Loaded' : 'Load'}</i>${c.badge ? `<i class="ws-menu-card-exp${c.badge === 'Early access' ? ' ws-menu-card-ea' : ''}">${c.badge}</i>` : ''}</span>
          <b>${c.name}</b><small>${c.label}</small>
        </button>`;
      }).join('')}</div></div>
      <div class="ws-menu-dots">${cards.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <div class="ws-menu-modes"><button class="ws-menu-mode ws-menu-play" type="button"><span class="ws-menu-mode-glyph">${SWORD}</span><b>Enter world</b><small></small></button></div>
      <div class="ws-menu-row"><button class="ws-menu-settings" type="button">Settings</button></div>
    </div>`;
  if (opts.notice) {
    const notice = document.createElement('div');
    notice.className = 'ws-menu-recovery';
    notice.setAttribute('role', 'status');
    notice.textContent = opts.notice;
    required(root, '.ws-menu-head').append(notice);
  }

  const summary = document.createElement('div');
  summary.className = 'ws-title-summary';
  summary.setAttribute('aria-label', GAME_STRINGS.summary.label);
  const paintSummary = (): void => {
    const view = summaryView(readSummary(), cards);
    summary.hidden = !view.visited;
    summary.dataset['variant'] = setting('titleSummary');
    summary.replaceChildren();
    for (const line of view.lines) {
      const row = document.createElement('div'); row.className = 'ws-title-summary-line';
      const name = document.createElement('span'); name.textContent = line.name;
      const value = document.createElement('span');
      value.textContent = !line.visited ? GAME_STRINGS.summary.notVisited : line.total === null ? GAME_STRINGS.summary.unknown(line.earned) : GAME_STRINGS.summary.known(line.earned, line.total);
      row.append(name, value); summary.append(row);
    }
    const total = document.createElement('strong'); total.className = 'ws-title-summary-total';
    total.textContent = GAME_STRINGS.summary.total(view.earned); summary.append(total);
  };
  paintSummary();
  required(root, '.ws-menu-dots').after(summary);
  const stopSummary = onSettingChange('titleSummary', paintSummary);

  const hero = required(root, '.ws-menu-hero');
  const list = required(root, '.ws-menu-cards');
  const track = required(root, '.ws-menu-deck-track');
  const hint = required(root, '.ws-menu-play small');
  const cardEls = Array.from(root.querySelectorAll<HTMLElement>('.ws-menu-card'));
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.ws-menu-dots i'));
  const portrait = (): boolean => innerWidth < innerHeight;
  const heroUrl = (c: TitleCard): string => (portrait() ? c.heroPortrait : c.heroLandscape);
  let index = Math.max(0, activeIndex);

  // paginated track: one card per swipe, always centred — no native scroll, so it can't rest between cards
  const place = (i: number, extra = 0, animate = true): void => {
    const card = cardEls[i];
    if (card === undefined) return;
    track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    track.style.transform = `translateX(${list.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2) + extra}px)`;
  };
  const apply = (): void => {
    const c = cards[index];
    if (c === undefined) return;
    cardEls.forEach((e, i) => { e.classList.toggle('selected', i === index); });
    dots.forEach((d, i) => { d.classList.toggle('on', i === index); });
    hero.style.backgroundImage = `url('${heroUrl(c)}')`;
    hero.classList.add('show');
    hint.textContent = hintFor(c, index === activeIndex);
  };
  const select = (raw: number, smooth = true): void => {
    const i = Math.max(0, Math.min(cards.length - 1, raw));
    place(i, 0, smooth);
    if (i !== index) { index = i; apply(); }
  };
  const activate = (): void => { const c = cards[index]; if (c) opts.onEnter(c); };

  // swipe → the track follows the finger (rubber-banded at the ends), release = one page in the swipe direction
  let drag: { id: number; x0: number; t0: number; dx: number } | null = null;
  list.addEventListener('pointerdown', (e) => {
    if (drag) return;
    drag = { id: e.pointerId, x0: e.clientX, t0: performance.now(), dx: 0 };
    list.setPointerCapture(e.pointerId);
  });
  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    const atEnd = (drag.dx > 0 && index === 0) || (drag.dx < 0 && index === cards.length - 1);
    place(index, atEnd ? drag.dx * 0.3 : drag.dx, false);
  });
  let swipedAt = 0; // a swipe's trailing click must not re-select the card under the finger
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, t0 } = drag; drag = null;
    const v = dx / Math.max(1, performance.now() - t0); // px/ms
    if (Math.abs(dx) > 36 || (Math.abs(v) > 0.35 && Math.abs(dx) > 14)) { swipedAt = performance.now(); select(index + (dx < 0 ? 1 : -1)); }
    else place(index);
  };
  list.addEventListener('pointerup', endDrag); list.addEventListener('pointercancel', endDrag);
  cardEls.forEach((e, i) => { e.addEventListener('click', (ev) => { ev.stopPropagation(); if (i !== index && performance.now() - swipedAt > 400) select(i); }); });
  dots.forEach((d, i) => { d.addEventListener('click', (ev) => { ev.stopPropagation(); select(i); }); });
  required(root, '.ws-menu-play').addEventListener('click', (ev) => { ev.stopPropagation(); activate(); });
  required(root, '.ws-menu-explore').addEventListener('click', (ev) => { ev.stopPropagation(); const c = cards[index]; if (c) opts.onExplore(c); });
  required(root, '.ws-menu-settings').addEventListener('click', (ev) => { ev.stopPropagation(); opts.onSettings(); });

  // hero art is ~0.2–0.3 MB a file and every card has two (portrait + landscape): only the selected card's, in the
  // orientation on screen, loads with the deck. A neighbour's loads when a swipe or a dot press starts toward it, so the
  // crossfade on release is usually instant (LOAD-PERF, first-launch transfer)
  const warmed = new Set<string>();
  const warm = (i: number): void => { const c = cards[i]; const u = c ? heroUrl(c) : ''; if (u && !warmed.has(u)) { warmed.add(u); new Image().src = u; } };
  list.addEventListener('pointerdown', () => { warm(index - 1); warm(index + 1); });
  dots.forEach((d, i) => { d.addEventListener('pointerdown', () => { warm(i); }); });

  // orientation flips swap the hero file and re-centre the selected card (card width is viewport-relative). iOS (E131): a
  // rotation can fire `resize` before the new layout settles, and may leave the strip natively scrolled — so re-centre
  // whenever the strip's own box really changes too
  let wasPortrait = portrait();
  const onResize = (): void => {
    place(index, 0, false);
    if (portrait() !== wasPortrait) { wasPortrait = portrait(); apply(); }
  };
  addEventListener('resize', onResize);
  const strip = new ResizeObserver(() => { list.scrollLeft = 0; if (!drag) place(index, 0, false); });
  strip.observe(list);

  apply();
  return {
    root, cards,
    get index() { return index; },
    select, activate,
    start: () => { place(index, 0, false); requestAnimationFrame(() => { place(index, 0, false); }); },
    dispose: () => { stopSummary(); removeEventListener('resize', onResize); strip.disconnect(); },
  };
}
