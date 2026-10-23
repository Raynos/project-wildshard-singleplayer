import type { Plugin } from 'vite';
import ts from '@typescript/typescript6';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readModuleFiles } from '../src/engine/boot/download';
import { bootProductTotals } from './bootProducts';
import { homeExtraFiles } from './bootExtras';
import { createHash } from 'node:crypto';

/** Only imports actually scheduled by startSelected; title, recovery and error
 * branches elsewhere in the entry module are not home requirements. */
export function startupImports(source: string): string[] {
  const file = ts.createSourceFile('entry.ts', source, ts.ScriptTarget.Latest, true);
  const selected = file.statements.find(row => ts.isFunctionDeclaration(row) && row.name?.text === 'startSelected');
  if (selected === undefined) throw new Error('Missing selected startup import bank');
  const imports = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      for (let owner = node.parent; owner !== selected; owner = owner.parent) {
        if (ts.isIfStatement(owner) || ts.isConditionalExpression(owner) || ts.isSwitchStatement(owner)
          || ts.isCatchClause(owner) || ts.isForStatement(owner) || ts.isForOfStatement(owner) || ts.isForInStatement(owner)
          || ts.isWhileStatement(owner) || ts.isDoStatement(owner)) {
          throw new Error('Conditional startup imports require a selected module bank');
        }
        if (ts.isArrowFunction(owner) && (!ts.isCallExpression(owner.parent) || owner.parent.expression.getText(file) !== 'retried')) {
          throw new Error('Deferred startup imports require a selected module bank');
        }
        if (ts.isFunctionExpression(owner) || ts.isFunctionDeclaration(owner)) throw new Error('Deferred startup imports require a selected module bank');
      }
      if (node.arguments.length !== 1) throw new Error('Startup import requires a literal source');
      const argument = node.arguments[0];
      if (argument === undefined || !ts.isStringLiteral(argument)) throw new Error('Startup import requires a literal source');
      imports.add(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(selected);
  return [...imports];
}

interface EmittedFile {
  readonly type: string;
  readonly code?: string;
  readonly source?: string | Uint8Array;
  readonly imports?: readonly string[];
  readonly originalFileNames?: readonly string[];
  readonly modules?: Readonly<Record<string, unknown>>;
}
type Bundle = Readonly<Record<string, EmittedFile | undefined>>;
export type ModuleFile = readonly [url: string, bytes: number];

/** Static closure only: dynamic imports describe possible future work. Imported
 * asset URL strings do not imply image/model downloads either. */
export function bootModuleFiles(bundle: Bundle, roots: readonly string[]): readonly ModuleFile[] {
  const files = new Set<string>();
  const visit = (name: string): void => {
    if (files.has(name)) return;
    const file = bundle[name];
    if (file?.type !== 'chunk' || file.code === undefined) throw new Error(`Missing boot module dependency: ${name}`);
    files.add(name);
    for (const dependency of file.imports ?? []) visit(dependency);
  };
  for (const root of roots) {
    const found = Object.entries(bundle).filter(([, file]) => file?.type === 'chunk' && Object.hasOwn(file.modules ?? {}, root));
    if (found.length !== 1) throw new Error(`Missing or ambiguous boot module root: ${root}`);
    for (const [name] of found) visit(name);
  }
  // cssCodeSplit=false: the page always reads the single extracted stylesheet.
  for (const [name, file] of Object.entries(bundle)) if (file?.type === 'asset' && name.endsWith('.css')) files.add(name);
  return readModuleFiles([...files].sort().map(name => {
    const file = bundle[name];
    const bytes = file?.type === 'chunk' ? file.code : file?.source;
    if (bytes === undefined) throw new Error(`Missing boot module bytes: ${name}`);
    return [`/${name}`, typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength];
  }));
}

/** Compiler-owned facts ride the existing shell, including offline launches.
 * No metadata fetch, speculative import or new service-worker install list. */
export function bootModulesPlugin(): Plugin {
  let root = process.cwd(), inlineLimit = 4096;
  return {
    name: 'wildshard-boot-module-files',
    configResolved(config) {
      root = config.root;
      if (typeof config.build.assetsInlineLimit !== 'number') throw new Error('Boot inventory requires a numeric asset inline limit');
      inlineLimit = config.build.assetsInlineLimit;
      if (config.build.cssCodeSplit) throw new Error('Boot module facts require the page stylesheet inventory');
    },
    generateBundle: { order: 'post', async handler(_options, bundle) {
      const entry = resolve(root, 'src/entry.ts');
      const requests = startupImports(readFileSync(entry, 'utf8'));
      const ids: string[] = [entry];
      for (const request of requests) {
        const dependency = await this.resolve(request, entry);
        if (dependency === null || dependency.external !== false) throw new Error(`Unresolved boot module: ${request}`);
        ids.push(dependency.id);
      }
      if (!Object.hasOwn(bundle, 'index.html')) throw new Error('Missing boot module document');
      const html = bundle['index.html'];
      if (html?.type !== 'asset' || typeof html.source !== 'string' || !html.source.includes('<head>')) throw new Error('Missing boot module document');
      const client = await this.resolve('./game/shardfile/client', entry);
      if (client === null || client.external !== false) throw new Error('Missing compiled client module');
      const products = bootProductTotals(root), extras: Record<string, readonly [string, number, number, string]> = {};
      for (const prefix of Object.keys(products)) {
        const directory = prefix.split('/')[2];
        if (directory === undefined) throw new Error('Missing boot home directory');
        const files = homeExtraFiles(root, directory, bundle, inlineLimit);
        if (files === null) continue;
        const source = JSON.stringify(files), hash = createHash('sha256').update(source).digest('hex');
        const name = `assets/boot-${directory}-${hash.slice(0, 8)}.json`;
        this.emitFile({ type: 'asset', fileName: name, source });
        extras[prefix] = [`/${name}`, Buffer.byteLength(source), files.reduce((sum, row) => sum + row[1], 0), hash];
      }
      const rows = { common: bootModuleFiles(bundle, ids), client: bootModuleFiles(bundle, [client.id]), products, extras };
      const json = JSON.stringify(rows).replaceAll('<', String.raw`\u003c`);
      html.source = html.source.replace('<head>', `<head><script type="application/json" id="boot-module-files">${json}</script>`);
    } },
  };
}
