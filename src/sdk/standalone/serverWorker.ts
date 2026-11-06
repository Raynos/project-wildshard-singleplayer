import { loadRapier, type Rapier } from '@wildshard/engine/physics/rapier';
import { RAPIER_WASM_URL } from '@wildshard/engine/physics/wasmUrl';
import { askHeldReads, type HeldRead } from './heldReads';
import { runStandaloneServer } from './serverHost';
import { fetchServerProduct } from './serverProduct';

/** Physics, once, from the page's own copy where it holds one (DL25). */
let physics: Promise<Rapier> | undefined;
const rapierOf = (held: HeldRead | undefined): Promise<Rapier> => {
  physics ??= (async () => loadRapier(await held?.(new URL(RAPIER_WASM_URL, globalThis.location.href).href) ?? undefined))();
  return physics;
};

// P1-E5.2 (J49): the module worker every standalone target boots. There is no main-thread path to this code. The page
// hands over the control port, the game port and, on a page with a download, the port for what it holds, once; everything
// after that goes through them.
self.onmessage = (event: MessageEvent<unknown>): void => {
  self.onmessage = null;
  const [control, game, reads] = event.ports;
  if (control === undefined || game === undefined) return;
  const held = reads === undefined ? undefined : askHeldReads(reads);
  runStandaloneServer({ control, game, load: async (boot, slug) => fetchServerProduct(new URL(`../${slug}/`, new URL(boot.base, globalThis.location.href)).href, await rapierOf(held), held),
    onSaveRefused: error => { console.warn('Standalone save refused, falling back', error); } });
};
