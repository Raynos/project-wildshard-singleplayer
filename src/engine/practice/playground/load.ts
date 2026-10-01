/**
 * The playgrounds' loader (E307): each scene is its own lazy chunk, imported and built on the first tap of its card, and
 * kept for the rest of the page (a second visit is instant). main.ts calls it; the Explore hub only reads catalog.ts.
 */
import type { PlaygroundId } from './catalog';
import type { Playground, PlaygroundHost } from './Playground';

const built = new Map<PlaygroundId, Promise<Playground>>();

export function loadPlayground(id: PlaygroundId, host: PlaygroundHost): Promise<Playground> {
  let p = built.get(id);
  if (p === undefined) {
    p = id === 'grapple'
      ? import('#shards/nine-dragon-stack/playground/GrapplePlayground').then(({ GrapplePlayground }) => new GrapplePlayground(host))
      : import('#shards/nalati-grasslands/playground/HorsePlayground').then(({ HorsePlayground }) => new HorsePlayground(host));
    built.set(id, p);
    p.catch(() => { built.delete(id); }); // a failed import can be tried again
  }
  return p;
}
