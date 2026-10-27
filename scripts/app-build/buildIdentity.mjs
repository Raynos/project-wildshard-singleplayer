import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The deploy identity belongs to the document, not every hashed runtime module.
 * Vite replaces __BUILD_ID__ with this stable expression in both page and worker
 * code; standalone workers without a document have an empty identity. */
export const BUILD_ID_EXPRESSION = '(globalThis.__WS_BUILD_ID__ ?? "")';

/** Stamp before executable module scripts, without changing the bundle's URLs.
 * @param {string} html @param {string} build */
export function stampBuildHtml(html, build) {
  if (build.length === 0 || !/^[\w.-]+$/u.test(build)) throw new Error('Invalid document build identity');
  if (html.includes('globalThis.__WS_BUILD_ID__=')) throw new Error('Duplicate document build identity');
  const heads = [...html.matchAll(/<head(?:\s[^>]*)?>/giu)];
  if (heads.length !== 1 || heads[0]?.index === undefined) throw new Error('Missing or ambiguous document head');
  const end = heads[0].index + heads[0][0].length;
  return `${html.slice(0, end)}<script>globalThis.__WS_BUILD_ID__=${JSON.stringify(build)};</script>${html.slice(end)}`;
}

/** Plain post-bundle step, before the service worker hashes the final HTML.
 * Every document entry gets the same version.json identity, including native
 * index.html and the calibration entry. No new Vite plugin or fetched module.
 * @param {string} directory */
export function stampBuildDocuments(directory) {
  /** @type {unknown} */
  const version = JSON.parse(readFileSync(resolve(directory, 'version.json'), 'utf8'));
  if (typeof version !== 'object' || version === null || !('build' in version) || typeof version.build !== 'string') throw new Error('Missing document build identity');
  const documents = new Set(['index.html']);
  const manifest = resolve(directory, '.vite/manifest.json');
  if (existsSync(manifest)) {
    /** @type {unknown} */
    const entries = JSON.parse(readFileSync(manifest, 'utf8'));
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) throw new Error('Invalid document entry manifest');
    for (const [name, entry] of Object.entries(entries)) {
      if (typeof entry !== 'object' || entry === null || !('isEntry' in entry) || entry.isEntry !== true || !name.endsWith('.html')) continue;
      const path = resolve(directory, name);
      if (!path.startsWith(`${resolve(directory)}/`)) throw new Error('Document entry escapes build');
      documents.add(name);
    }
  }
  for (const name of documents) {
    const path = resolve(directory, name);
    writeFileSync(path, stampBuildHtml(readFileSync(path, 'utf8'), version.build));
  }
}
