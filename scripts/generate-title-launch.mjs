#!/usr/bin/env node
// Render the first-document shell as iOS's pre-document launch image.
// Rebuild after changing its approved hero/style: node scripts/generate-title-launch.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { browserPool } from './parity/pool.mjs';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'index.html'), 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const shell = source.match(/<div class="ws-launch" data-title-shell>[\s\S]*?<\/svg>\s*<\/div>\s*<\/div>/)?.[0];
if (style === undefined || shell === undefined) throw new Error('Missing first-document title shell');
const output = resolve(root, 'public/assets/title/launch-1206x2622.png');
const pool = browserPool(root, 1, 'metal');
try {
  const browser = await pool.browser(0);
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await context.route('http://launch.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') {
        await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html class="title-first"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${style}</style></head><body>${shell}</body></html>` });
      } else if (path.startsWith('/assets/title/') || path.startsWith('/fonts/')) {
        const asset = resolve(root, 'public', `.${path}`);
        if (!asset.startsWith(`${resolve(root, 'public')}/`)) throw new Error('Invalid launch asset');
        await route.fulfill({ path: asset });
      } else throw new Error(`Unexpected launch dependency: ${path}`);
    });
    const page = await context.newPage();
    await page.goto('http://launch.test/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    mkdirSync(dirname(output), { recursive: true });
    await page.screenshot({ path: output, animations: 'disabled' });
    console.info(output);
  } finally { await context.close(); }
} finally { await pool.close(); }
