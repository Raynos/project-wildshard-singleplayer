import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

const NAME = 'virtual:wildshard-title', ID = `\0${NAME}`;
/** Compile the existing discovery data into the title without runtime shard imports. */
export function titleCataloguePlugin(): Plugin {
  let root = process.cwd(), source: string | null = null;
  return {
    name: 'wildshard-title-catalogue',
    configResolved(config) { root = config.root; },
    buildStart() {
      const output = execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/title-catalogue.mjs'],
        { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      const row = output.split('\n').reverse().find(line => line.startsWith('TITLE-CATALOGUE '));
      if (row === undefined) throw new Error('Missing compiled title catalogue');
      const decoded: unknown = JSON.parse(row.slice('TITLE-CATALOGUE '.length));
      if (typeof decoded !== 'string') throw new Error('Invalid compiled title catalogue');
      source = decoded;
    },
    resolveId(id) { return id === NAME ? ID : null; },
    load(id) {
      if (id !== ID) return null;
      if (source === null) throw new Error('Title catalogue not prepared');
      return source;
    },
  };
}
