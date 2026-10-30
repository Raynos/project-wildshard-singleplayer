/** Plain post-build PWA emission. Runtime caching owns no graph, accounting or hash work. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { ASSET_CACHE_NAME } from '../../src/engine/pwa/cacheNames';
import { titleAssetURLs } from '../title-assets.mjs';
import { writtenBundle, type EmittedFile } from './writtenBundle';

/** Update checks fetch this tiny bootstrap; the core URL names its exact bytes. */
export function workerScripts(core: string): { fileName: string; bootstrap: string } {
  const fileName = `sw-core/${createHash('sha256').update(core).digest('hex')}.js`;
  return { fileName, bootstrap: `importScripts(${JSON.stringify(`/${fileName}`)});\n` };
}

function shellFiles(html: string, root: string, sources: ReadonlyMap<string, string>): string[] {
  const files = new Set(['/manifest.webmanifest']);
  const publicRoot = resolve(root, 'public');
  const add = (url: string): void => {
    if (!url.startsWith('/') || url.startsWith('//') || url.includes('?') || url.includes('#')) return;
    const file = resolve(publicRoot, `.${sources.get(url) ?? url}`);
    if (file.startsWith(`${publicRoot}${sep}`) && existsSync(file) && statSync(file).isFile()) files.add(url);
  };
  // The first-paint shell's own public images/icons, not an unrelated world bank.
  for (const match of html.matchAll(/(?:\b(?:src|href)=["']|url\(["']?)(\/[^\s"'<>)]*)/gu)) {
    if (match[1] !== undefined) add(match[1]);
  }
  // Native title-image cache routes fall back to network on a miss. Install
  // every named deck portrait too, so that fallback cannot repeat each visit.
  for (const url of sources.keys()) add(url);
  const fonts = join(publicRoot, 'fonts');
  if (existsSync(fonts)) for (const file of readdirSync(fonts)) if (file.endsWith('.woff2')) add(`/fonts/${file}`);
  return [...files].sort();
}

/** The build owns names. No worker parses boot banks, packs or runtime product metadata. */
export function serviceWorkerCore(bundle: Readonly<Record<string, EmittedFile>>, root: string, buildId: string): {
  core: string; build: string; assets: string; hashed: string[];
} {
  const document = bundle['index.html'];
  if (document?.type !== 'asset' || document.source === undefined) throw new Error('Missing worker document');
  const html = new TextDecoder().decode(document.source);
  const hashed = Object.keys(bundle).filter(name => /^assets\/[^/]+-[\w-]{8}\.\w+$/u.test(name)).map(name => `/${name}`).sort();
  const sources = new Map(Object.entries(titleAssetURLs(root)).map(([source, url]) => [url, source]));
  const shell = shellFiles(html, root, sources), digest = createHash('sha256');
  const owner = readFileSync(join(root, 'src/engine/app/workerScope.js'), 'utf8').replaceAll(/^export /gmu, '');
  const worker = readFileSync(join(root, 'src/engine/pwa/sw.js'), 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '');
  const source = `${owner}\n${worker}`;
  digest.update(source);
  for (const name of [...hashed, '/index.html']) {
    const file = bundle[name.slice(1)];
    if (file === undefined) throw new Error(`Missing worker file: ${name}`);
    digest.update(name).update(file.type === 'chunk' ? file.code ?? '' : file.source ?? new Uint8Array());
  }
  for (const name of shell) if (name !== '/index.html') digest.update(name).update(readFileSync(join(root, 'public', sources.get(name) ?? name)));
  const build = `${buildId}-${digest.digest('hex').slice(0, 10)}`;
  const core = source.replaceAll('__BUILD_ID__', build).replaceAll('__ASSET_CACHE__', ASSET_CACHE_NAME)
    .replace("'__FILES__'", JSON.stringify(JSON.stringify(hashed)))
    .replace("'__SHELL_FILES__'", JSON.stringify(JSON.stringify(shell)))
    .replace("'__DOCUMENT__'", JSON.stringify(html));
  return { core, build, assets: ASSET_CACHE_NAME, hashed };
}

/** Called after ordinary bundling; previous-deploy chunks are carried by MF2 afterwards. */
export function writeServiceWorker(outDir: string, root: string): void {
  const { build: buildId } = JSON.parse(readFileSync(join(outDir, 'version.json'), 'utf8')) as { build: string };
  const { core, build, hashed } = serviceWorkerCore(writtenBundle(outDir, root), root, buildId), scripts = workerScripts(core);
  mkdirSync(dirname(join(outDir, scripts.fileName)), { recursive: true });
  writeFileSync(join(outDir, scripts.fileName), core);
  writeFileSync(join(outDir, 'sw.js'), scripts.bootstrap);
  console.log(`sw.js written (${build}; ${ASSET_CACHE_NAME}; ${hashed.length} precached files)`);
}
