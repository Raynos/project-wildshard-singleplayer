import { readRigRest, readRigMotion } from '@wildshard/sdk/bake/rig';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';

/** Read a retained authored figure/arm GLB without a page, GPU or live animation service. */
export async function readersExample(glb: Uint8Array, animationGlb = glb) {
  const rest = await readRigRest(glb);
  try {
    const motion = await readRigMotion(animationGlb);
    const image = await readImagePixels(rest.colourImage);
    const png = await writeImagePixels(image);
    const decoded = await readImagePixels(png);
    return { bones: rest.bones, clips: motion.clips.map(clip => clip.name), image, decoded };
  } finally { rest.geometry.dispose(); }
}
