// GR8 G37: Pine's sources for a Node script, read and baked exactly as the program reads them (readPineSources over the
// SDK's generation context and its shared cache): the timber world is the program's, so a script cannot read it from disk.
import { createProjectGeneration } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { readPineSources } from './programSources.ts';

const project = new URL('..', import.meta.url).pathname.replace(/\/$/u, ''), assets = new URL('../../../../public/assets', import.meta.url).pathname;

/** Pine's sources for the script named `label` (its generation cache key). */
export function pineScriptSources(label) {
  const roots = [{ prefix: '/assets/', directory: assets }];
  return readPineSources(createProjectGeneration(project, hashImmutableBytes(new TextEncoder().encode(label)), new Map(), undefined, roots));
}
