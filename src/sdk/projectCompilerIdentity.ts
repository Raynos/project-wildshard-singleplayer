// oxlint-disable-next-line import/no-nodejs-modules -- Compiler keys cover the installed tools' actual source bytes.
import { readdirSync, realpathSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the pinned installed compiler dependency graph.
import { createRequire } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Package-relative names, never installation paths, enter the key.
import { dirname, resolve, relative } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Vite consumes the SDK's defining compiler entry files.
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import * as v from 'valibot';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { readBoundedFile } from './sourceReader';

const Package = v.object({ name: v.string(), version: v.string(), dependencies: v.optional(v.record(v.string(), v.string()), {}) });
const external = ['binaryen', 'assemblyscript/dist/asc.js'];
let captured: Promise<string> | undefined;

/** Hash a build tool's bundled implementation and installed external compiler closure.
 * This conservative identity is captured once per immutable CLI process; the product receipt still traces source reads. */
export function projectCompilerIdentity(): Promise<string> {
  captured ??= capture(); return captured;
}
async function capture(): Promise<string> {
  const built = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: [fileURLToPath(import.meta.resolve('@wildshard/sdk/compileScript'))], formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, ...external] } } });
  const result = Array.isArray(built) ? built[0] : built;
  if (result === undefined || !('output' in result)) throw new Error('Missing generation compiler identity');
  const chunks = result.output.filter(row => row.type === 'chunk'), names = new Set(chunks.map(row => row.fileName));
  if (chunks.length === 0 || result.output.some(row => row.type !== 'chunk')
    || chunks.some(row => [...row.imports, ...row.dynamicImports].some(name => !names.has(name) && !name.startsWith('node:') && !external.includes(name)))) throw new Error('Unknown generation compiler dependency');
  const files: [string, string][] = chunks.map(row => [`sdk/${row.fileName}`, hashImmutableBytes(new TextEncoder().encode(row.code))]);
  files.push(...compilerPackageInputs([{ name: 'binaryen', from: import.meta.url }, { name: 'assemblyscript', from: import.meta.url, specifier: 'assemblyscript/dist/asc.js' }]));
  files.sort(([a, ah], [b, bh]) => a.localeCompare(b) || ah.localeCompare(bh));
  return hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ version: 1, files })));
}

/** Capture actual runtime and standard-library files, including transitive installed compiler versions. */
export function compilerPackageInputs(packages: readonly { readonly name: string; readonly from: string; readonly specifier?: string }[]): readonly [string, string][] {
  const files: [string, string][] = [];
  const visited = new Set<string>(); let count = 0, total = 0;
  const packageInputs = (name: string, from: string, specifier = name): void => {
    let root = dirname(realpathSync(createRequire(from).resolve(specifier)));
    for (;;) {
      const path = resolve(root, 'package.json');
      if (existsSync(path) && v.parse(v.object({ name: v.optional(v.string()) }), JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readBoundedFile(path, 1_000_000)))).name === name) break;
      const parent = dirname(root); if (parent === root) throw new Error('Missing compiler package identity'); root = parent;
    }
    if (visited.has(root)) return; visited.add(root);
    const metadata = resolve(root, 'package.json'), pkg = v.parse(Package, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readBoundedFile(metadata, 1_000_000))));
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Compiler package contains a symbolic source');
        if (entry.isDirectory()) walk(path);
        else if (entry.isFile() && /\.(?:[cm]?js|ts|wasm|json)$/u.test(entry.name)) {
          const bytes = readBoundedFile(path, 64_000_000); total += bytes.byteLength;
          if (++count > 10000 || total > 256_000_000) throw new Error('Compiler package identity exceeds bounds');
          files.push([`${pkg.name}@${pkg.version}/${relative(root, path).replaceAll('\\', '/')}`, hashImmutableBytes(bytes)]);
        }
      }
    };
    walk(root);
    for (const dependency of Object.keys(pkg.dependencies).sort()) packageInputs(dependency, metadata);
  };
  for (const row of packages) packageInputs(row.name, row.from, row.specifier);
  return files.sort(([a, ah], [b, bh]) => a.localeCompare(b) || ah.localeCompare(bh));
}
