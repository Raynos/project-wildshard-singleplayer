import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';

const NAME = 'virtual:wildshard-title', ID = `\0${NAME}`;
const SELECTION='virtual:wildshard-selection', SELECTION_ID=`\0${SELECTION}`;
/** Compile the existing discovery data into the title without runtime shard imports. */
export function titleCataloguePlugin(): Plugin {
  let root = process.cwd(), source: string | null = null, selection:string|null=null;
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
      const selected=output.split('\n').find(line=>line.startsWith('TITLE-SELECTION '));
      if(selected===undefined)throw new Error('Missing selected discovery loaders');
      const loaders:unknown=JSON.parse(selected.slice('TITLE-SELECTION '.length));
      if(typeof loaders!=='string')throw new Error('Invalid selected discovery loaders');
      selection=loaders;
    },
    resolveId(id) { return id === NAME ? ID : id===SELECTION?SELECTION_ID:null; },
    load(id) {
      if(id===SELECTION_ID){if(selection===null)throw new Error('Selected discovery not prepared');return selection;}
      if (id !== ID) return null;
      if (source === null) throw new Error('Title catalogue not prepared');
      return source;
    },
  };
}
