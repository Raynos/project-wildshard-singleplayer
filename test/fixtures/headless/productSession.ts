// oxlint-disable-next-line import/no-nodejs-modules -- Native integration owns the admitted named product bytes.
import {readFileSync} from 'node:fs';
import {HeadlessSimulation} from '../../../src/sdk/headless';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {productHeadlessSections} from '../../../src/sdk/headlessSections';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {builtProduct} from '../builtProduct';
import {createNativeProofWorker} from '../headless-worker';

/** The same checked products and fixed native adapters as the main integration journey. */
export async function openProductSession(slug:string):Promise<{sim:Pick<HeadlessSimulation,'journey'|'walkLeg'|'step'|'dispose'|'quarantined'>;product:Awaited<ReturnType<typeof loadHeadlessProduct>>}> {
  const directory=builtProduct(slug),product=await loadHeadlessProduct(directory),source=product.shardfile;
  const descriptor=outputDescriptor(source);if(descriptor===undefined)throw new Error('Missing admitted headless inventory');
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
    Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const sections=productHeadlessSections(product);
  const nativeKinds={'driftwood-isle':'driftwood','pine-hollow':'pine','nine-dragon-stack':'nine','nalati-grasslands':'nalati'} as const;
  const nativeKind=!sections.has('sim/runtime-plan')&&(slug==='driftwood-isle'||slug==='pine-hollow'||slug==='nine-dragon-stack'||slug==='nalati-grasslands')?nativeKinds[slug]:undefined;
  const sim=nativeKind===undefined?await HeadlessSimulation.create(source,assets,undefined,{deadline:'advisory',sections})
    :await createNativeProofWorker(source,assets,nativeKind,undefined,sections,directory);
  return {sim,product};
}
