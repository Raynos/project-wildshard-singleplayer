import { onFault, type Fault } from './engine/core/faults';
import { loadRapier } from './engine/physics/rapier';
import { practiceAssetUrl } from './practiceAssets';
import { Scope } from './engine/app/scope';
import { ktx2TranscodeSupport } from './engine/core/ktx2';
import { browserContentHash } from './game/shardfile/product';
import { loadShardProduct } from './game/shardfile/runtimeProduct';
import { startPracticeDemo, type PracticeDemo } from './game/practiceDemo/startPracticeDemo';
import { practiceLevel } from './practiceLevel';
import { preparePracticeContent } from './practiceContent';
import { readPracticePresentation } from './practicePresentation';
import { configurePracticeOcclusion } from './practiceLighting';

/** WIP ROOTED PITCHER: source-body living collision; HELD DEATH/NO FOLD, NOT ADMITTED.
 * Separate explicit entry; no session, world plugin, service worker or persistent save boot. */
export async function bootPractice(canvas: HTMLCanvasElement, status: (message: string) => void): Promise<PracticeDemo> {
  const productOwner = new Scope('practice-demo-product');
  try {
    const product = await loadShardProduct('driftwood-isle', {
      base: new URL('practice-product/', document.baseURI).href, firstParty: true, offline: false,
      fetch: url => fetch(url), hash: browserContentHash, textures: ktx2TranscodeSupport(),
    }, productOwner);
    const physics = await fetch(practiceAssetUrl('/assets/physics/rapier.wasm'));
    if (!physics.ok) throw new Error(`Practice physics fetch failed: ${physics.status}`);
    await loadRapier(await physics.arrayBuffer());
    const presentation = readPracticePresentation(JSON.parse(new TextDecoder().decode(await product.file('practice/looks.json'))));
    const demo = await startPracticeDemo({ canvas, level: practiceLevel(presentation.arenaLighting), product,
      nativePractice: { 'brine-pitcher-matriarch:brine-pitcher-matriarch': { poseFile: 'poses/brine-pitcher-native-owner.json', corpse: 'anchored-held', livingBodyBone: 'body' } },
      prepare: game => preparePracticeContent(game, product), status });
    configurePracticeOcclusion(demo.game.post?.ao ?? null, presentation.arenaOcclusion);
    demo.game.levelScope.expose(window, '__practiceDemo', demo);
    const faults: Fault[] = [];
    demo.game.levelScope.expose(window, '__rootedPitcherFaults', faults);
    demo.game.levelScope.onDispose(onFault(fault => { faults.push(fault); }));
    demo.game.levelScope.onDispose(() => { productOwner.dispose(); });
    return demo;
  } catch (error: unknown) { productOwner.dispose(); throw error; }
}
