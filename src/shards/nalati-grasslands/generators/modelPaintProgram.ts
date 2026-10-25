import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { MODEL_FILES, bakeModelPaint } from './modelPaint.mjs';

const inputPrefix = '/assets/nalati/models/';

/** Original model GLBs as owned cached bytes; no source/public file publication. */
export async function nalatiModelPaintProgram(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'model-paint', native: true, inputs: MODEL_FILES.map(file => `${inputPrefix}${file}`) }, async inputs => {
    const painted = new Map<string, Uint8Array>();
    for (const file of MODEL_FILES) {
      const input = inputs.get(`${inputPrefix}${file}`), name = file.split('.')[0];
      if (input === undefined || name === undefined) throw new Error(`Missing authored Nalati model: ${file}`);
      painted.set(file, await bakeModelPaint(input, name));
    }
    return painted;
  });
  if (files.size !== MODEL_FILES.length || [...files.keys()].some(file => !MODEL_FILES.includes(file))) {
    throw new Error('Nalati painted model inventory differs');
  }
  for (const file of MODEL_FILES) {
    const bytes = files.get(file);
    if (bytes === undefined || bytes.length < 20) throw new Error(`Missing owned Nalati model: ${file}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.length) {
      throw new Error(`Invalid owned Nalati model: ${file}`);
    }
  }
  return files;
}
