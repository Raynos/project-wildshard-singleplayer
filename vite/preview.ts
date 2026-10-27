import type { Plugin, UserConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { rapierPreviewPlugin } from './rapier';

interface HeaderRule { source: string; headers: { key: string; value: string }[] }

/**
 * `vercel.json` `source` → RegExp. Only the forms the file uses: literal paths and `(.*)` groups
 * (Vercel's path-to-regexp escapes everything else, `.` included).
 */
function sourceRegex(source: string): RegExp {
  const esc = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`^${source.split('(.*)').map(esc).join('(.*)')}/?$`);
}

function vercelHeaders(root: string): { re: RegExp; headers: { key: string; value: string }[] }[] {
  const p = join(root, 'vercel.json');
  if (!existsSync(p)) return [];
  const rules = (JSON.parse(readFileSync(p, 'utf8')) as { headers?: HeaderRule[] }).headers ?? [];
  return rules.map((r) => ({ re: sourceRegex(r.source), headers: r.headers }));
}

/** Preview mirrors the production host: the same vercel.json rules, last match wins per header (the bench measures
 *  what production sends: `immutable` on the hashed bundle, revalidated `sw.js`, no-store document/version.json).
 *  Preview only; the worker itself is written by scripts/app-build/serviceWorker.ts after the build. */
export function previewHeadersPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'wildshard-preview-headers',
    configResolved(c) { root = c.root; },
    configurePreviewServer(server) {
      const rules = vercelHeaders(root);
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const pathname = req.url?.split('?')[0] ?? '';
        for (const r of rules) if (r.re.test(pathname)) for (const h of r.headers) res.setHeader(h.key, h.value);
        if (pathname === '/sw.js' || pathname.startsWith('/sw-core/')) {
          // The public worker is identical for every Origin, like production.
          // Preview CORS otherwise splits WebKit's HTTP cache between a soft
          // navigation update (Origin present) and reg.update() (absent).
          const value = res.getHeader('Vary');
          const varying = (Array.isArray(value) ? value.join(',') : String(value ?? '')).split(',')
            .map(part => part.trim()).filter(part => part !== '' && part.toLowerCase() !== 'origin');
          if (varying.length === 0) res.removeHeader('Vary');
          else res.setHeader('Vary', varying.join(', '));
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        next();
      });
    },
  };
}

/** Serve an existing build with production headers and WASM compression, without running asset generators again. */
export function previewConfig(): UserConfig {
  return { plugins: [previewHeadersPlugin(), rapierPreviewPlugin()] };
}
