// oxlint-disable-next-line import/no-nodejs-modules -- Native integration owns the admitted named product bytes.
import {readFileSync} from 'node:fs';
import {HeadlessSimulation} from '../../../src/sdk/headless';
import {loadHeadlessProduct} from '../../../src/sdk/headlessProduct';
import {productHeadlessSections} from '../../../src/sdk/headlessSections';
import {outputDescriptor} from '../../../src/game/shardfile/outputDescriptor';
import {builtProduct} from '../builtProduct';
import {createNativeProofWorker,type NativeProofKind} from '../headless-worker';

export type ProductSessionVariant = Extract<NativeProofKind, 'driftwood' | 'nine-flat' | 'nalati-companions' | 'nalati-weapons' | 'nalati-predators' | 'nalati-world' | 'nalati-verbs' | 'nalati-kokpar' | 'pine-verbs' | 'sky-verbs'>;
const variantHosts: Readonly<Record<string, string>> = { 'driftwood': 'driftwood-isle', 'sky-verbs': 'far-reach', 'pine-verbs': 'pine-hollow', 'nine-flat': 'nine-dragon-stack', 'nalati-companions': 'nalati-grasslands', 'nalati-weapons': 'nalati-grasslands', 'nalati-predators': 'nalati-grasslands', 'nalati-world': 'nalati-grasslands', 'nalati-verbs': 'nalati-grasslands', 'nalati-kokpar': 'nalati-grasslands' };

type ProductSimulation=Pick<HeadlessSimulation,'verbTape'|'verbTapePart'|'streamVerbTape'|'journey'|'walkLeg'|'step'|'dispose'|'quarantined'>;

/** Start the independent replay owner while its caller records native input.
 * Readiness still awaits the same worker admission and initial checkpoint. */
export async function beginProductSession(slug:string,variant?:ProductSessionVariant,snapshot?:string):Promise<{ready:()=>Promise<ProductSimulation>;assets:ReadonlyMap<string,Uint8Array>;product:Awaited<ReturnType<typeof loadHeadlessProduct>>}> {
  if(variant!==undefined&&variantHosts[variant]!==slug)throw new Error('Native proof variant does not match product');
  const directory=builtProduct(slug),product=await loadHeadlessProduct(directory),source=product.shardfile;
  const descriptor=outputDescriptor(source);if(descriptor===undefined)throw new Error('Missing admitted headless inventory');
  const assets=new Map(descriptor.index.files.map(file=>[file.commons===true?`commons:${file.hash}`:file.hash,
    Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const sections=productHeadlessSections(product);
  const nativeKinds={'driftwood-isle':'driftwood','pine-hollow':'pine','nine-dragon-stack':'nine','nalati-grasslands':'nalati'} as const;
  const nativeKind=variant??(!sections.has('sim/runtime-plan')&&(slug==='driftwood-isle'||slug==='pine-hollow'||slug==='nine-dragon-stack'||slug==='nalati-grasslands')?nativeKinds[slug]:undefined);
  const pending=nativeKind===undefined?HeadlessSimulation.create(source,assets,snapshot,{deadline:'advisory',sections})
    :createNativeProofWorker(source,assets,nativeKind,snapshot,sections,directory);
  // Observe failure immediately even while the caller is preparing its owner.
  const outcome=pending.then(sim=>({ok:true as const,sim}),(error:unknown)=>({ok:false as const,error}));
  return {product,assets,ready:async()=>{const result=await outcome;if(!result.ok)throw result.error;return result.sim;}};
}

/** The same checked products and fixed native adapters as the main integration journey. */
export async function openProductSession(slug:string,variant?:ProductSessionVariant,snapshot?:string):Promise<{sim:ProductSimulation;product:Awaited<ReturnType<typeof loadHeadlessProduct>>}> {
  const session=await beginProductSession(slug,variant,snapshot);
  return {sim:await session.ready(),product:session.product};
}
