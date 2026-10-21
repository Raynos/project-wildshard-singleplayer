// Trusted compiler bridge: Rolldown reads source in Rust, outside Node fs hooks.
import { build as viteBuild } from 'vite';
import { recordBundle, inputRecorderPlugin } from './shardfile-inputs.mjs';
import * as v from 'valibot';

// Explicit compiler intent: this bundle executes in Node and its JavaScript
// is never copied into a product. Ordinary runtime bundles keep exact bytes.
const Execution = v.object({name:v.literal('wildshard-author-execution'),api:v.object({wildshardInputIdentity:v.literal('execution')})});

export { parseSync } from 'vite';
/** @param {import('vite').InlineConfig} options */
export async function build(options) {
  const execution=options.plugins?.some(plugin=>v.is(Execution,plugin))===true;
  const result = await viteBuild({...options,plugins:[inputRecorderPlugin({execution}),...(options.plugins ?? [])]});
  recordBundle(result,{execution}); return result;
}
