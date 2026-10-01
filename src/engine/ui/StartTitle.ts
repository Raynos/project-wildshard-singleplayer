/** Renderer-free opening title: the shared title deck (src/game/titleDeck.ts, E318 — the same deck "Exit to main" shows).
 *  Only the selected shard's hero art is decoded. */
import { setTitleArrival, type TitleArrivalMode } from '../boot/titleArrival';
import { markUnload } from '../boot/lastEnd';
import { previousNineBootLine } from '../boot/nineBootTrace';
import { buildTitleDeck, titleCards, type TitleCard } from '#game/titleDeck';

export function showStartTitle(): void {
  const hud = document.getElementById('hud');
  if (hud === null) throw new Error('Start title: missing #hud');
  hud.classList.add('intro');
  const launch = (card: TitleCard, mode: TitleArrivalMode): void => {
    setTitleArrival({ slug: card.slug, mode });
    markUnload(`title chose ${card.slug} (${mode})`);
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('chunk', card.slug);
    location.assign(url.toString());
  };
  const interrupted = previousNineBootLine();
  const deck = buildTitleDeck({
    cards: titleCards(), active: null,
    onEnter: (card) => { launch(card, 'enter'); },
    onExplore: (card) => { launch(card, 'explore'); },
    onSettings: () => { void import('./BootSettings').then(({ openBootSettings }) => openBootSettings()); },
    ...(interrupted ? { notice: `${interrupted}\nReturned to shard select. Choose a world when ready.` } : {}),
  });
  hud.append(deck.root);
  deck.start();
  document.dispatchEvent(new Event('ws:ready'));
}

showStartTitle();
