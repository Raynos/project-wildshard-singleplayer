import type { Texture } from 'three';

/**
 * The page environment the last drawn frame lit with (G639 frame floor). A backdrop layer swaps a cell's PMREM into the
 * page scene by its weight (`BackdropLayer.apply`), so the road beside a cell draws with that cell's environment while a
 * warm-up between frames may see none: a view root's warm-up (`precompile.ts`, exterior jobs) also keys the variant the
 * road last drew with. A leaf module, held weakly; Game notes it after each drawn frame.
 */
let drawn: WeakRef<Texture> | null = null;
/** record the environment the frame just drawn lit with (null: none) */
export function noteDrawnEnvironment(environment: Texture | null): void {
  if (environment === null) return;
  if (drawn?.deref() !== environment) drawn = new WeakRef(environment);
}
/** the last non-null environment a drawn frame lit with, while it is alive */
export function drawnEnvironment(): Texture | null { return drawn?.deref() ?? null; }
