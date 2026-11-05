import { loadRapier } from '@wildshard/engine/physics/rapier';
import { runStandaloneServer } from './serverHost';
import { fetchServerProduct } from './serverProduct';

// P1-E5.2 (J49): the module worker every standalone target boots. There is no main-thread path to this code. The page
// hands over the control port and the game port once; everything after that goes through them.
self.onmessage = (event: MessageEvent<unknown>): void => {
  self.onmessage = null;
  const [control, game] = event.ports;
  if (control === undefined || game === undefined) return;
  runStandaloneServer({ control, game, load: async boot => fetchServerProduct(boot.base, await loadRapier()) });
};
