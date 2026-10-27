import type { Plugin } from 'vite';
import ts from '@typescript/typescript6';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readModuleFiles } from '../src/engine/boot/download';
import { homeClientModuleGroups } from '../scripts/app-build/bootProducts';
import { bootTierProductTotals } from '../scripts/app-build/bootProductTiers';
import { homeExtraFiles } from '../scripts/app-build/bootExtras';
import { createHash } from 'node:crypto';
import { selectionModules } from '../scripts/title-catalogue.mjs';

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

/** Literal optional imports stay attached to their defining feature row. */
export function clientFeatureImports(source: string): Readonly<Record<string, readonly string[]>> {
  const file = ts.createSourceFile('clientPlan.ts', source, ts.ScriptTarget.Latest, true);
  const rows: Record<string, string[]> = {};
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'CLIENT_FEATURES' && node.initializer !== undefined && ts.isObjectLiteralExpression(node.initializer)) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) throw new Error('Feature module bank requires literal feature rows');
        rows[property.name.text] = literalImports(property.initializer);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return rows;
}
function literalImports(node: ts.Node): string[] {
  const rows = new Set<string>();
  const visit = (entry: ts.Node): void => {
    if (ts.isCallExpression(entry) && entry.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [source] = entry.arguments;
      if (source === undefined || !ts.isStringLiteral(source)) throw new Error('Boot module requires a literal import');
      rows.add(source.text);
    }
    ts.forEachChild(entry, visit);
  };
  visit(node); return [...rows];
}
function sourceImports(file: string): readonly string[] {
  return existsSync(file) ? literalImports(ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)) : [];
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

/** One shared file table avoids repeating common chunks for every feature. */
export function bootModuleGroups(bundle: Bundle, roots: Readonly<Record<string, readonly string[]>>): {
  files: ModuleFile[]; groups: Record<string, number[]>;
} {
  const files: ModuleFile[] = [], indexes = new Map<string, number>(), groups: Record<string, number[]> = {};
  for (const [kind, paths] of Object.entries(roots)) groups[kind] = paths.length === 0 ? [] : bootModuleFiles(bundle, paths).map(row => {
    const prior = indexes.get(row[0]); if (prior !== undefined) return prior;
    const next = files.length; indexes.set(row[0], next); files.push(row); return next;
  });
  return {files,groups};
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
      const grid = await this.resolve('./game/grid/session', entry);
      if (grid === null || grid.external !== false) throw new Error('Missing grid session module');
      const gridRoots = [grid.id];
      for (const file of ['src/game/session/play.ts', 'src/game/session/loadout.ts']) {
        const importer = resolve(root, file);
        for (const request of sourceImports(importer).filter(name => name.startsWith('../grid/'))) {
          const dependency = await this.resolve(request, importer);
          if (dependency === null || dependency.external !== false) throw new Error('Missing grid boot module');
          gridRoots.push(dependency.id);
        }
      }
      const planFile = resolve(root, 'src/game/shardfile/clientPlan.ts'), featureRoots: Record<string, string[]> = {};
      const features = existsSync(planFile) ? clientFeatureImports(readFileSync(planFile, 'utf8')) : {};
      for (const [kind, imports] of Object.entries(features)) {
        const paths: string[] = [];
        for (const request of imports) {
          const dependency = await this.resolve(request, planFile);
          if (dependency === null || dependency.external !== false) throw new Error('Missing optional client module');
          paths.push(dependency.id);
        }
        featureRoots[kind] = paths;
      }
      for (const [kind, request] of [['presentation', '../plugin/ui'], ['loot', '../loot/runtime'], ['compendium', '../compendium/install']] as const) {
        featureRoots[kind] = [];
        if (!sourceImports(client.id).includes(request)) continue;
        const dependency = await this.resolve(request, client.id);
        if (dependency === null || dependency.external !== false) throw new Error('Missing optional client presentation');
        featureRoots[kind].push(dependency.id);
      }
      // Practice keeps its synchronous room; only arena arrivals await these existing lazy model/clip loaders.
      const practice: string[] = [];
      for (const file of ['src/engine/practice/TrainingArena.ts', 'src/engine/models/trainingDummy.ts', 'src/engine/models/trainingDummyFigure.ts']) {
        const importer = resolve(root, file);
        for (const request of sourceImports(importer)) {
          const dependency = await this.resolve(request, importer);
          if (dependency === null || dependency.external !== false) throw new Error('Missing practice model module');
          practice.push(dependency.id);
        }
      }
      featureRoots['practice.models'] = practice;
      for (const [kind, file] of [['models.gltf', 'src/engine/anim/rig.ts'], ['legacy.gltf', 'src/game/shard/load.ts']] as const) {
        const importer = resolve(root, file), paths: string[] = [];
        for (const request of sourceImports(importer)) {
          const dependency = await this.resolve(request, importer);
          if (dependency === null || dependency.external !== false) throw new Error('Missing optional GLTF module');
          paths.push(dependency.id);
        }
        featureRoots[kind] = paths;
      }
      const loadout = resolve(root, 'src/game/session/loadout.ts');
      featureRoots['explorer.catalogue'] = [];
      for (const request of sourceImports(loadout).filter(name => name === '../models/explorerCatalogue')) {
        const dependency = await this.resolve(request, loadout);
        if (dependency === null || dependency.external !== false) throw new Error('Missing selected Explorer module');
        featureRoots['explorer.catalogue'].push(dependency.id);
      }
      const products = bootTierProductTotals(root), extras: Record<string, readonly [string, number, number, string]> = {};
      for (const prefix of Object.keys(products)) {
        const directory = prefix.split('/')[2];
        if (directory === undefined) throw new Error('Missing boot home directory');
        featureRoots[`home:${prefix}`] = homeClientModuleGroups(root, directory).flatMap(kind => {
          const roots = featureRoots[kind];
          if (roots === undefined) throw new Error(`Missing selected home code group: ${kind}`);
          return roots;
        });
        const files = homeExtraFiles(root, directory, bundle, inlineLimit);
        if (files === null) continue;
        const source = JSON.stringify(files), hash = createHash('sha256').update(source).digest('hex');
        const name = `assets/boot-${directory}-${hash.slice(0, 8)}.json`;
        this.emitFile({ type: 'asset', fileName: name, source });
        extras[prefix] = [`/${name}`, Buffer.byteLength(source), files.reduce((sum, row) => sum + row[1], 0), hash];
      }
      const selected:Record<string,readonly ModuleFile[]>={};
      for(const row of selectionModules(root))selected[row.slug]=bootModuleFiles(bundle,[resolve(root,row.file)]);
      let catalogueFiles:readonly ModuleFile[]=[];
      if(Object.keys(selected).length>0){
        const catalogue=await this.resolve('./shardList',entry);
        if(catalogue===null||catalogue.external!==false)throw new Error('Missing full discovery module');
        catalogueFiles=bootModuleFiles(bundle,[catalogue.id]);
      }
      const rows = { common: bootModuleFiles(bundle, ids), client: bootModuleFiles(bundle, [client.id]), grid: bootModuleFiles(bundle, gridRoots), optional: bootModuleGroups(bundle, featureRoots), selection:selected, catalogue:catalogueFiles, products, extras };
      const json = JSON.stringify(rows).replaceAll('<', String.raw`\u003c`);
      html.source = html.source.replace('<head>', `<head><script type="application/json" id="boot-module-files">${json}</script>`);
    } },
  };
}
