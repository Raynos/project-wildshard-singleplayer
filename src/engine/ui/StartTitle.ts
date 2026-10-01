import { app } from '../app/runtime';
import { onDev } from '../core/devMode';
import { uiScope, mountUi } from './ownership';
/** Renderer-free opening title: the shared title deck (src/game/titleDeck.ts, E318 — the same deck "Exit to main" shows).
 *  Only the selected shard's hero art is decoded. */
import { previousBootLine } from '../boot/bootTrace';
import { buildTitleDeck, titleCards, travel, type TitleCard, type TitleDeck } from '#game/titleDeck';

export function showStartTitle(): void {
  const scope = uiScope('StartTitle', app.engineScope);
  const hud = document.getElementById('hud');
  if (hud === null) throw new Error('Start title: missing #hud');
  hud.classList.add('intro');
  const launch = (card: TitleCard, mode: 'enter' | 'explore'): void => { travel({ to: card.slug, mode }); };
  const interrupted = previousBootLine();
  let deck: TitleDeck | undefined;
  const refresh = (): void => {
    const selected = deck?.cards[deck.index]?.slug;
    deck?.root.remove(); deck?.dispose();
    deck = buildTitleDeck({
      cards: titleCards(), active: null,
      onEnter: (card) => { launch(card, 'enter'); },
      onExplore: (card) => { launch(card, 'explore'); },
      onSettings: () => { void import('./BootSettings').then(({ openBootSettings }) => openBootSettings()); },
      ...(interrupted ? { notice: `${interrupted}\nReturned to shard select. Choose a world when ready.` } : {}),
    });
    mountUi(deck.root, scope, hud);
    const index = deck.cards.map((card): string => card.slug).indexOf(selected ?? '');
    if (index !== -1) deck.select(index, false);
    deck.start();
  };
  refresh();
  scope.onDispose(onDev(refresh));
  scope.onDispose(() => { deck?.dispose(); });
  document.dispatchEvent(new Event('ws:ready'));
}

showStartTitle();
