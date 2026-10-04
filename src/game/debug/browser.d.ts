import type { EngineProbe, HarnessPins } from '@wildshard/engine';

// The page's debug handles, the game's names for them (E405 E414: the engine reaches them through the app identity,
// src/game/identity.ts). Capture and test scripts read `window.__wildshard` and set `window.__wildshardHarness`.
declare global {
  interface Window { __wildshard?: EngineProbe; __wildshardHarness?: HarnessPins }
}
