import { markUnload } from '@wildshard/engine/boot/lastEnd';

interface TitleNavigation {
  readonly url: string;
  replace: (url: string) => void;
}

function browserNavigation(): TitleNavigation { return {
  url: location.href,
  replace: url => { markUnload('exit to main menu (fresh page)'); location.replace(url); },
}; }

/** The document owns the world. Leave immediately; the browser releases it.
 * No disposal chain or worker handover may gate the replacement title. */
export function exitSessionToTitle(navigation: TitleNavigation = browserNavigation()): void {
  navigation.replace(new URL('/', navigation.url).href);
}
