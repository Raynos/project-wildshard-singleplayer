import type { PlaygroundHost } from '@wildshard/engine/practice/playground/Playground';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Ride } from '../ride/ride';
// the card's art: the rider at a canter down the jump lane's rails, shot live in Nalati's grade (E325)
import playgroundHorse from '../explore/playground-horse.webp';

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 3.2c-1.6.2-3 .9-4.1 2L8.3 8.4c-1.2.5-2.2 1.4-2.8 2.6L3.6 14.8c-.3.6-.1 1.3.5 1.6.5.2 1 .1 1.4-.3l1.9-2.2.3 5.6c0 .6.5 1 1.1 1s1-.5 1-1.1l.2-3.9h4.4l.6 4c.1.6.6 1 1.2.9.6-.1 1-.6.9-1.2l-.8-5.8c1.3-.9 2.1-2.4 2.1-4l.1-1.3 1.7-.5c.6-.2.9-.8.7-1.4l-.3-1c.6-.5.8-1.4.4-2.1z"/></svg>';
export function horsePlayground(ride: Ride | null): Parameters<ShardContext['playground']>[0] {
  return { id: 'horse', title: 'Horse playground', blurb: 'Oval track · jumps · lap timer', icon: ICON, art: playgroundHorse,
    load: async () => {
      const { HorsePlayground } = await import('./HorsePlayground');
      return class extends HorsePlayground { constructor(host: PlaygroundHost) { super({ ...host, ride }); } };
    },
  };
}
