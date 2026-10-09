#!/usr/bin/env node
// Build author tools against the same public contract as the game; pnpm pack uses these portable JS modules.
import { build } from 'vite';
import { relative, resolve } from 'node:path';
import { cpSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { rapierAlias } from '../vite/rapier.ts';
import { assertHeavyLease } from './heavy-lane-lease.mjs';
import { shardfileValidationRevision } from './shardfile-validation-revision.mjs';

// This package also compiles the two real app clients; acquire the build lane before generation or type emission.
assertHeavyLease('build');
const root = resolve(import.meta.dirname, '..');
process.chdir(root);
execFileSync('node', ['scripts/gen.mjs'], { cwd: root, stdio: 'inherit' });
const sdk = JSON.parse(readFileSync(resolve(root, 'src/sdk/package.json'), 'utf8'));
const modules = Object.entries(sdk.exports).map(([specifier, target]) => {
  if (!specifier.startsWith('./') || typeof target !== 'string' || !target.endsWith('.ts')) throw new Error('SDK workspace exports must name defining TypeScript modules');
  return { name: specifier.slice(2), source: resolve(root, 'src/sdk', target), declaration: target.slice(2, -3) };
});
await build({ configFile: false, publicDir: false, resolve: { alias: rapierAlias }, logLevel: 'warn', define: { __SHARDFILE_VALIDATOR__: JSON.stringify(shardfileValidationRevision(root)) }, build: { outDir: resolve(root, 'src/sdk', 'dist') /* build output, git-ignored: check-paths only checks committed paths */, emptyOutDir: true, minify: false, lib: {
  entry: Object.fromEntries([...modules.map(({ name, source }) => [name, source]), ['cli', resolve(root, 'src/sdk/cli.ts')], ['headlessWorker', resolve(root, 'src/sdk/headlessWorker.ts')]]), formats: ['es'], fileName: (_format, name) => `${name}.js`,
}, rolldownOptions: { platform: 'node', external: [/^node:/u, 'vite', 'sharp', 'binaryen'] } } });

// Ship declarations without requiring the repository's internal workspace packages.
execFileSync('pnpm', ['exec', 'tsc', '-b', '--force', 'tsconfig.layers.json'], { cwd: root, stdio: 'inherit' });
const seen = new Set();
function declaration(layer, module) {
  const key = `${layer}/${module}`;
  if (seen.has(key)) return;
  seen.add(key);
  const source = resolve(root, `.tsc-layers/${layer}/src/${layer}/${module}.d.ts`);
  const output = resolve(root, `src/sdk/dist/types/${key}.d.ts`);
  // Ambient defining leaves are compiler inputs, so tsc does not emit a second copy of them.
  let text = readFileSync(existsSync(source) ? source : resolve(root, `src/${layer}/${module}.d.ts`), 'utf8');
  // Relative import declarations are illegal inside ambient modules; the equivalent type query remains portable.
  if (key === 'engine/types/n8ao') text = text.replace("import type { Renderer } from '@wildshard/engine/render/renderer';", "type Renderer = import('@wildshard/engine/render/renderer').Renderer;");
  text = text.replaceAll(/(['"])@wildshard\/(engine|game|sdk)\/([^'"]+)\1/gu, (_match, quote, dependencyLayer, dependency) => {
    declaration(dependencyLayer, dependency);
    const from = resolve(root, `src/sdk/dist/types/${layer}`, module, '..');
    const to = resolve(root, `src/sdk/dist/types/${dependencyLayer}/${dependency}`);
    // Public declarations may only refer to packaged files or third-party dependencies.
    return `${quote}${relative(from, to).replaceAll('\\', '/')}${quote}`;
  });
  // Relative declaration imports remain in the same copied module tree.
  for (const match of text.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/gu)) {
    const dependency = relative(resolve(root, `src/${layer}`), resolve(root, `src/${layer}`, module, '..', match[2]));
    if (!dependency.startsWith('..')) declaration(layer, dependency.replace(/\.js$/u, ''));
  }
  if (/from\s*['"]n8ao['"]/u.test(text)) {
    declaration('engine', 'types/n8ao');
    // declaration() above generates this packaged output; only src/sdk is a committed input path.
    const vendor = relative(resolve(output, '..'), resolve(root, 'src/sdk', 'dist', 'types/engine/types/n8ao.d.ts')).replaceAll('\\', '/');
    text = `/// <reference path="${vendor}" />\n${text}`;
  }
  mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, text);
}
for (const module of modules) declaration('sdk', module.declaration);

// Both clients use the normal Game bundle. Author dev is a separate compiled mode, never enabled by requests.
for (const [mode, folder] of [['production', 'client'], ['devserver', 'client-devserver']]) {
  await build({ root, mode, configFile: resolve(root, 'vite.config.ts'), logLevel: 'warn', build: {
    outDir: resolve(root, `src/sdk/dist/${folder}`), emptyOutDir: true, copyPublicDir: false, sourcemap: false,
  } });
  for (const entry of ['fonts', 'favicon.png', 'apple-touch-icon.png', 'manifest.webmanifest', 'basis/r186', 'assets/physics', 'assets/sfx/best', 'assets/music/piano', 'assets/music/orchestral', 'assets/music/folk']) cpSync(resolve(root, 'public', entry), resolve(root, `src/sdk/dist/${folder}`, entry), { recursive: true });
}
