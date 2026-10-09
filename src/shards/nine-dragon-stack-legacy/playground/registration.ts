import type { PlaygroundSpec } from '@wildshard/engine/level/context';
import grappleArt from '../explore/playground-grapple.webp';

const CLAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2v9.3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="3.4" r="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11.5c-3.9 0-6.6 2.5-6.9 6.6l1.9-1.3M12 11.5c3.9 0 6.6 2.5 6.9 6.6l-1.9-1.3M12 11.5v10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export const GRAPPLE_PLAYGROUND: PlaygroundSpec = {
  id: 'grapple', title: 'Grapple playground', blurb: 'Fei Zhua parkour · dev course · timer', icon: CLAW, art: grappleArt,
  load: async () => (await import('./GrapplePlayground')).GrapplePlayground,
};
