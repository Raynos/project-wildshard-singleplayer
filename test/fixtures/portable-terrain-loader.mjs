// Test-only evaluation codec: ES2015 lowers ** to Math.pow, which the
// portable-math scope can replace too. Resolve guards remain in force.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from '@typescript/typescript6';

/** @param {readonly string[]} urls exact terrain sources under comparison */
export function registerPortableTerrain(urls = [new URL('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts', import.meta.url).href]) {
  const targets = new Set(urls);
  return registerHooks({ load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!targets.has(url)) return loaded;
    return { ...loaded, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
    }).outputText };
  } });
}
