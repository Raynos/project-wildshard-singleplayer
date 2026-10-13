import type { EngineProbe, HarnessPins } from '@wildshard/engine/debug/probe';

// The page's debug handles, the game's names for them (E405 E414: the engine reaches them through the app identity,
// src/game/identity.ts). Capture and test scripts read `window.__wildshard` and set `window.__wildshardHarness`.
declare global {
  interface Window {
    __wildshard?: EngineProbe;
    /** `nearEvery` (G380 / G385): the hero captures' C, every grid cell on its near view; a capture pin, never a setting */
    __wildshardHarness?: HarnessPins & { readonly nearEvery?: boolean };
  }
}
