#!/usr/bin/env node
// The native page (docs/plans/NATIVE-APPS.md, D24: was vite.config.ts's native plugin): `vite build --mode native` builds
// native.html, the web page with the web-only boot swapped for src/native.ts. No service worker (WKWebView has none on
// capacitor://, and the bundle is already on disk), no update pill (native updates are the signed OTA channel), no Google
// Fonts (bundled: the app must boot offline). A committed gen:source table (G798) made from index.html; build-app names it
// index.html in dist-native/ (capacitor.config.ts `webDir`).
//
//   node scripts/native-page.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WEB_ONLY_HTML = [
  /\s*<link rel="manifest"[^>]*>/,
  /\s*<script type="module" src="\/src\/engine\/boot\/sw\.ts"><\/script>/,
  /\s*<script type="module" src="\/src\/engine\/ui\/Update\.ts"><\/script>/,
];

/** The native page from the web page's text. */
export function nativePage(html) {
  let out = html;
  for (const re of WEB_ONLY_HTML) {
    if (!re.test(out)) throw new Error(`[native] index.html no longer matches ${String(re)} — update WEB_ONLY_HTML in scripts/native-page.mjs`);
    out = out.replace(re, '');
  }
  // any Google Fonts link (the native entry bundles the faces itself; optional, the web page may self-host them)
  out = out.replaceAll(/\s*<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
  const main = '<script type="module" src="/src/entry.ts"></script>'; // the web entry (it imports src/main.ts)
  if (!out.includes(main)) throw new Error('[native] index.html has no src/entry.ts script to swap for src/native.ts');
  return out.replace(main, '<script type="module" src="/src/native.ts"></script>');
}

/** native.html as index.html makes it. */
export function nativePageTable(root) {
  return { 'native.html': nativePage(readFileSync(resolve(root, 'index.html'), 'utf8')) };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(import.meta.dirname, '..'), page = nativePageTable(root)['native.html'], file = resolve(root, 'native.html');
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(file, 'utf8'); } catch { /* missing is stale */ }
    if (current !== page) { console.error('native-page: native.html is stale (run node scripts/native-page.mjs)'); process.exit(1); }
  } else writeFileSync(file, page);
}
