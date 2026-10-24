// CF1: resolve layer membership from candidate Git bytes, without a TS program.
import { execFileSync } from 'node:child_process';
import { posix, relative, resolve } from 'node:path';
import ts from '@typescript/typescript6';

/** Lazy immutable candidate reader, also used by the Vitest input override.
 * @param {string} root */
export function stagedFiles(root) {
  // A nested fixture must not read its enclosing commit's temporary index.
  const env = resolve(root) === process.cwd() ? process.env
    : Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28 });
  const entries = new Map(git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean).map(row => {
    const at = row.indexOf('\t'), metadata = row.slice(0, at).split(' ');
    if (metadata[2] !== '0') throw new Error('Unmerged commit index');
    return [row.slice(at + 1), metadata[1] ?? ''];
  }));
  /** @type {Map<string, string>} */
  const cache = new Map();
  return { paths: [...entries.keys()], read(/** @type {string} */ name) {
    const oid = entries.get(name);
    if (oid === undefined) return undefined;
    if (!cache.has(name)) cache.set(name, git(['cat-file', 'blob', oid]));
    return cache.get(name);
  } };
}

/** The pinned compiler's own glob matcher preserves include/exclude semantics.
 * Only filenames and config/import bytes come from the index.
 * @param {string} root @param {ReturnType<typeof stagedFiles>} staged */
export function stagedProjects(root, staged) {
  /** @type {Map<string, {files:Set<string>,directories:Set<string>}>} */
  const directories = new Map();
  for (const file of staged.paths) {
    let parent = posix.dirname(file), child = posix.basename(file), directory = false;
    while (true) {
      if (!directories.has(parent)) directories.set(parent, { files: new Set(), directories: new Set() });
      const entry = directories.get(parent);
      if (entry === undefined) throw new Error('Missing staged directory');
      (directory ? entry.directories : entry.files).add(child);
      if (parent === '.') break;
      child = posix.basename(parent); parent = posix.dirname(parent); directory = true;
    }
  }
  /** @type {unknown} */
  const matcher = Reflect.get(ts, 'matchFiles');
  if (typeof matcher !== 'function') throw new Error('Installed TypeScript has no config glob matcher');
  const name = (/** @type {string} */ file) => relative(root, resolve(file)).replaceAll('\\', '/');
  /** @type {import('@typescript/typescript6').ParseConfigFileHost} */
  const host = {
    useCaseSensitiveFileNames: true, getCurrentDirectory: () => root,
    fileExists: file => staged.paths.includes(name(file)), readFile: file => staged.read(name(file)),
    readDirectory(path, extensions, excludes, includes, depth) {
      /** @type {unknown} */
      const result = Reflect.apply(matcher, undefined, [path, extensions, excludes, includes, true, root, depth,
        (/** @type {string} */ directory) => {
          const key = name(directory);
          const row = directories.get(key === '' ? '.' : key);
          return { files: [...(row?.files ?? [])], directories: [...(row?.directories ?? [])] };
        }, (/** @type {string} */ file) => file]);
      if (!Array.isArray(result) || !result.every(file => typeof file === 'string')) throw new Error('Invalid TypeScript config glob result');
      return result;
    },
    onUnRecoverableConfigFileDiagnostic: diagnostic => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  };
  /** @type {Map<string, import('@typescript/typescript6').ParsedCommandLine>} */
  const projects = new Map();
  /** @returns {import('@typescript/typescript6').ParsedCommandLine} */
  const project = (/** @type {string} */ config) => {
    const cached = projects.get(config);
    if (cached !== undefined) return cached;
    const parsed = ts.getParsedCommandLineOfConfigFile(resolve(root, config), {}, host);
    if (parsed === undefined || parsed.errors.some(error => error.code !== 18003)) throw new Error(`Cannot read staged project ${config}`);
    projects.set(config, parsed); return parsed;
  };
  for (const config of staged.paths.filter(file => /^tsconfig\.(?:engine|format|game|sdk|commons|shards|app)\.json$/u.test(file)
    || /^src\/(?:engine|format|game|sdk|commons|shards)\/tsconfig\.test\.json$/u.test(file))) project(config);
  return { projects, project, name, host };
}

/** Real TS6307 edges refuse, including type imports and .js substitutions.
 * Referenced projects remain legal; unrelated root-test fixtures do not.
 * @param {string} root @param {string[]} files */
export function stagedProjectFailures(root, files) {
  const staged = stagedFiles(root), { projects, project, name, host } = stagedProjects(root, staged), failures = [];
  for (const [config, parsed] of projects) {
    const testWorkspace = /^src\/([^/]+)\/tsconfig\.test\.json$/u.exec(config)?.[1];
    const prefix = `src/${testWorkspace ?? config.slice('tsconfig.'.length, -'.json'.length)}/`;
    const selected = files.filter(file => (config === 'tsconfig.app.json' ? /^src\/[^/]+$/u.test(file) : file.startsWith(prefix))
      && /\.[cm]?tsx?$/u.test(file) && staged.read(file) !== undefined
      && (testWorkspace === undefined ? !file.endsWith('.test.ts') || !projects.has(`${prefix}tsconfig.test.json`) : file.endsWith('.test.ts')));
    if (selected.length === 0) continue;
    const allowed = new Set(parsed.fileNames.map(name)), visited = new Set([config]);
    const references = [...(parsed.projectReferences ?? [])];
    while (references.length > 0) {
      const reference = references.pop();
      if (reference === undefined) break;
      const path = name(ts.resolveProjectReferencePath(reference));
      if (visited.has(path)) continue;
      visited.add(path); const dependency = project(path);
      for (const file of dependency.fileNames) allowed.add(name(file));
      references.push(...(dependency.projectReferences ?? []));
    }
    for (const file of selected) {
      if (!parsed.fileNames.some(target => name(target) === file)) failures.push(`TS6307 ${file}: not listed by ${config}`);
      const source = staged.read(file) ?? '';
      for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
        const target = ts.resolveModuleName(imported.fileName, resolve(root, file), parsed.options, host).resolvedModule;
        let dependency = target === undefined || target.isExternalLibraryImport ? undefined : name(target.resolvedFileName);
        const workspace = /^@wildshard\/([^/]+)\/(.+)$/u.exec(imported.fileName);
        if (workspace !== null) {
          const manifest = staged.read(`src/${workspace[1]}/package.json`);
          if (manifest !== undefined) {
            /** @type {unknown} */
            const raw = JSON.parse(manifest);
            if (typeof raw === 'object' && raw !== null) {
              const exports = Reflect.get(raw, 'exports');
              if (typeof exports === 'object' && exports !== null) {
                const value = Reflect.get(exports, `./${workspace[2]}`);
                if (typeof value === 'string' && value.startsWith('./')) dependency = `src/${workspace[1]}/${value.slice(2)}`;
              }
            }
          }
        }
        if (dependency === undefined) continue;
        if (staged.paths.includes(dependency) && !dependency.endsWith('.d.ts') && !allowed.has(dependency))
          failures.push(`TS6307 ${file}: ${imported.fileName} -> ${dependency} is outside ${config} and its references`);
      }
    }
  }
  return failures;
}
