// G363: changed roots with their real dependency types; CI checks all roots.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** @param {string[]} changed */
export async function checkChangedTypes(changed) {
  const { default: ts } = await import('@typescript/typescript6');
  const configs = ['tsconfig.json', 'scripts/tsconfig.json', 'api/tsconfig.json', 'admin/tsconfig.json', 'drafts/tsconfig.json'];
  const diagnostics = [];
  const layerDeclarations = new Set();
  const pending = existsSync('tsconfig.layers.json') ? [resolve('tsconfig.layers.json')] : [];
  const seen = new Set();
  while (pending.length > 0) {
    const config = pending.pop();
    if (config === undefined || seen.has(config)) continue;
    seen.add(config);
    const path = config.endsWith('.json') ? config : resolve(config,'tsconfig.json');
    const file = ts.readConfigFile(path, source => ts.sys.readFile(source));
    if (file.error) { diagnostics.push(file.error); continue; }
    const parsed = ts.parseJsonConfigFileContent(file.config,ts.sys,resolve(path,'..'));
    diagnostics.push(...parsed.errors);
    for (const source of parsed.fileNames) if (/\.d\.[cm]?ts$/u.test(source)) layerDeclarations.add(source);
    for (const reference of parsed.projectReferences ?? []) pending.push(reference.path);
  }
  const merges = existsSync('src') ? ts.sys.readDirectory(resolve('src'),['.ts'],['**/node_modules/**','**/sdk/dist/**'],['**/*.merge.d.ts']) : [];
  for (const config of configs) {
    if (!existsSync(config)) continue;
    const file = ts.readConfigFile(config, path => ts.sys.readFile(path));
    if (file.error) { diagnostics.push(file.error); continue; }
    const parsed = ts.parseJsonConfigFileContent(file.config, ts.sys, resolve(config, '..'));
    const members = new Set(parsed.fileNames.map(path => resolve(path)));
    const roots = changed.map(path => resolve(path)).filter(path => members.has(path) && existsSync(path));
    if (roots.length === 0) continue;
    const ambient = parsed.fileNames.filter(path => {
      if (/\.d\.[cm]?ts$/u.test(path)) return true;
      const source = readFileSync(path,'utf8');
      if (!/\bdeclare\s+(?:global|module)\b/u.test(source)) return false;
      // Module augmentations in ordinary TS files also contribute to the
      // full program, even when a changed root does not import that file.
      return ts.createSourceFile(path,source,ts.ScriptTarget.Latest).statements.some(statement => ts.isModuleDeclaration(statement));
    });
    if (config === 'tsconfig.json') ambient.push(...merges,...layerDeclarations);
    // The composition project includes Node tests and SDK authoring roots.
    // Full-program imports supply Node declarations; narrowed roots need them explicitly.
    const types = config === 'tsconfig.json' ? [...new Set([...(parsed.options.types ?? []), 'node'])] : parsed.options.types;
    const program = ts.createProgram([...new Set([...roots, ...ambient])], { ...parsed.options, types, noEmit: true });
    diagnostics.push(...parsed.errors, ...ts.getPreEmitDiagnostics(program));
  }
  if (diagnostics.length > 0) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => ts.sys.getCurrentDirectory(), getNewLine: () => '\n',
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (process.argv[2] !== 'types') throw new Error('Use types <changed.json>');
    await checkChangedTypes(JSON.parse(readFileSync(process.argv[3] ?? '', 'utf8')));
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
