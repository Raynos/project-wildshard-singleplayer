import type { PackedCreatureBodies } from '@wildshard/game/plugin/geometry';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import bake from '../data/creatureBodies.generated.json' with { type: 'json' };

let bodies: PackedCreatureBodies | null = null, loading: Promise<void> | null = null;

/** Keep the rendered decoder behind preload; native species imports never load shader patches. */
export function preloadCreatureBodies(): Promise<void> {
  const load = async (): Promise<void> => {
    try {
      const geometry = await import('@wildshard/game/plugin/geometry');
      bodies = geometry.packedCreatureBodies(bake); await bodies.preload();
    } catch (error: unknown) { bodies = null; loading = null; throw error; }
  };
  loading ??= load();
  return loading;
}

/** Fresh owned parts from the existing bake; asking before preload is a page fault. */
export function creatureBody(kind: string, variant: string): AnimalSpecies {
  if (bodies === null) throw new Error(`[driftwood-isle] creature bodies are not loaded (${kind}.${variant})`);
  return bodies.copy(kind, variant);
}
