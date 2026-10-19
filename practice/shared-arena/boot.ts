import { loadRapier } from '../../src/engine/physics/rapier';
import { practiceAssetUrl } from '../../src/practiceAssets';
import { Scope } from '../../src/engine/app/scope';
import { ktx2TranscodeSupport } from '../../src/engine/core/ktx2';
import { browserContentHash } from '../../src/game/shardfile/product';
import { loadShardProduct } from '../../src/game/shardfile/runtimeProduct';
import { practiceLevel } from '../../src/practiceLevel';
import { readPracticePresentation } from '../../src/practicePresentation';
import { startSharedArena, type PracticeDemo } from './runtime';
import { prepareSharedContent } from './content';
import type { ArenaProduct } from './types';

const catalogue = [
  { id: 'mantis', label: 'Splinter Mantis · motion 7' },
  { id: 'conch', label: 'Conch Duelist · motion 4' },
  { id: 'colossus', label: 'Tide-root Colossus · motion 2' },
  { id: 'puffer', label: 'Brine Puffer · V70' },
] as const;
/** Four exact data products, one engine and one arena. No world or durable cache authority. */
export async function bootSharedArena(canvas: HTMLCanvasElement, status: (message: string) => void): Promise<PracticeDemo> {
  const owner = new Scope('shared-arena-products');
  try {
    const products: ArenaProduct[] = [];
    for (const entry of catalogue) {
      const product = await loadShardProduct('driftwood-isle', {
        base: new URL(`products/${entry.id}/`, document.baseURI).href,
        firstParty: true, offline: false, fetch: url => fetch(url),
        hash: browserContentHash, textures: ktx2TranscodeSupport(),
      }, owner);
      products.push({ ...entry, product, presentation: readPracticePresentation(JSON.parse(new TextDecoder().decode(await product.file('practice/looks.json')))) });
    }
    const first = products[0];
    if (first === undefined) throw new Error('Arena has no admitted products');
    const physics = await fetch(practiceAssetUrl('/assets/physics/rapier.wasm'));
    if (!physics.ok) throw new Error(`Arena physics fetch failed: ${physics.status}`);
    await loadRapier(await physics.arrayBuffer());
    const demo = await startSharedArena({ canvas, level: practiceLevel(first.presentation.arenaLighting), products,
      prepare: game => prepareSharedContent(game, products), status });
    demo.game.levelScope.expose(window, '__practiceDemo', demo);
    demo.game.levelScope.onDispose(() => owner.dispose());
    return demo;
  } catch (error: unknown) { owner.dispose(); throw error; }
}
