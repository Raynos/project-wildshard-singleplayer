// fontWait — wait for the web fonts a canvas painter draws with (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts): sign
// faces are drawn into canvases, so their fonts must be in before the atlas is. Each font spec is loaded for the given
// characters; past the cap the painter goes on with the system fallbacks.
//
//   await waitForFonts(['700 64px "LXGW WenKai TC"'], text, 9000);
import { resourceScope } from '@wildshard/engine/app/resources';

/** Load every font spec for `text`, or give up after `capMs` (the page's resource scope's timer). */
export async function waitForFonts(specs: readonly string[], text: string, capMs: number): Promise<void> {
  const all = Promise.all(specs.map((s) => document.fonts.load(s, text)));
  await Promise.race([all.then(() => undefined), new Promise<void>((resolve) => { resourceScope().timeout(capMs, resolve); })]);
}
