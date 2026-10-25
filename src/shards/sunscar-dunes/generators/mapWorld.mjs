// Native map input, from the same author-only world bake as the product.
import { bakeSignalWorldSources } from './worldSources.ts';

/** Supply the existing painter's logical inputs directly; no world GLB or JSON is published or read back. */
export async function signalMapWorldFiles(well) {
  const { files } = await bakeSignalWorldSources(well), inputs = new Map();
  for (const [name, bytes] of files) {
    if (name.endsWith('.json')) inputs.set(`data/${name}`, bytes);
    else if (name.endsWith('.glb')) inputs.set(`../../../public/assets/sunscar-dunes/baked/${name}`, bytes);
  }
  return inputs;
}
