import type { Plugin } from 'vite';

/** Stamp the compiled mode in entry chunks and a machine-readable artifact; runtime URL/storage cannot change it. */
export function devserverFlags(devserver: boolean): Plugin {
  return { name: 'wildshard-devserver-flags', generateBundle(_options, bundle) {
    this.emitFile({ type: 'asset', fileName: 'build-flags.json', source: JSON.stringify({ devserver }) });
    for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) {
      chunk.code = `globalThis.__WILDSHARD_DEVSERVER__ = ${devserver};\n${chunk.code}`;
    }
  } };
}
