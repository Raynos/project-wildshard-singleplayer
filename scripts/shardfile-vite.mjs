// Trusted compiler bridge: Rolldown reads source in Rust, outside Node fs hooks.
import { build as viteBuild } from 'vite';
import { recordBundle, inputRecorderPlugin } from './shardfile-inputs.mjs';

export { parseSync } from 'vite';
/** @param {import('vite').InlineConfig} options */
export async function build(options) {
  const result = await viteBuild({...options,plugins:[inputRecorderPlugin(),...(options.plugins ?? [])]});
  recordBundle(result); return result;
}
