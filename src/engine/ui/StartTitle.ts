import { app } from '../app/runtime';
import { engineString } from '../strings';
import { onDev } from '../core/devMode';
import { uiScope, mountUi } from './ownership';
/** Renderer-free opening title: the shared title deck (src/game/titleDeck.ts, E318 — the same deck "Exit to main" shows).
 *  Only the selected shard's hero art is decoded. The entry hands in the deck builder (E405: the engine imports no game). */
import { previousBootLine } from '../boot/bootTrace';
import type { TitleDeckView } from './HUD';

/** builds the deck: every card opens its level in a fresh page; `notice` says why the last boot came back here */
export type StartTitleDeck = (opts: { settings: () => void; notice?: string }) => TitleDeckView;

export function showStartTitle(buildDeck: StartTitleDeck): void {
  const scope = uiScope('StartTitle', app.engineScope);
  const hud = document.getElementById('hud');
  if (hud === null) throw new Error('Start title: missing #hud');
  hud.classList.add('intro');
  const interrupted = previousBootLine();
  let deck: TitleDeckView | undefined;
  const refresh = (): void => {
    const selected = deck?.cards[deck.index]?.slug;
    deck?.root.remove(); deck?.dispose();
    deck = buildDeck({
      settings: () => { void import('./BootSettings').then(({ openBootSettings }) => openBootSettings()); },
      ...(interrupted ? { notice: `${interrupted}\n${engineString('s_returned_to_select')}` } : {}),
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

