import type { Game } from '@wildshard/engine/core/Game';
import { markUnload } from '@wildshard/engine/boot/lastEnd';

interface TitleNavigation {
  readonly url: string;
  activate: () => Promise<unknown>;
  replace: (url: string) => void;
}

function browserNavigation(): TitleNavigation { return {
  url: location.href,
  activate: () => window.__ws_sw?.activate() ?? Promise.resolve(false),
  replace: url => { markUnload('exit to main menu (fresh page)'); location.replace(url); },
}; }

/** Main-menu exit retires every page-owned world before presenting another entry choice.
 * Replacement also prevents WebKit from retaining the old renderer in its back/forward cache. */
export async function exitSessionToTitle(game: Pick<Game, 'dispose'>, navigation: TitleNavigation = browserNavigation()): Promise<void> {
  const title = new URL(navigation.url);
  title.search = ''; title.hash = '';
  // QB7 (Jake 13:48: a legacy Pine exit threw 'Scope level disposal failed' and left him on a dead page): a failed
  // teardown is logged, and the exit still reaches the fresh title, which owns nothing of the old session
  try { game.dispose(); }
  catch (error: unknown) { console.error('[title] session disposal failed on exit; continuing to the title', error); }
  try { await navigation.activate(); }
  catch (error: unknown) { console.warn('[title] update activation unavailable', error); }
  navigation.replace(title.href);
}
