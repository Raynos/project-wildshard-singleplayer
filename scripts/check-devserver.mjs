#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Every production entry must carry the false runtime stamp; a dev client or missing stamp cannot pass. */
export function assertProductionBuild(directory) {
  const flags = JSON.parse(readFileSync(resolve(directory, 'build-flags.json'), 'utf8'));
  if (flags?.devserver !== false) throw new Error('Production build has DEVSERVER enabled or no false build flag');
  let stamps = 0;
  const walk = (path) => {
    for (const file of readdirSync(path, { withFileTypes: true })) {
      const full = resolve(path, file.name);
      if (file.isDirectory()) walk(full);
      else if (file.name.endsWith('.js')) {
        const code = readFileSync(full, 'utf8');
        for (const match of code.matchAll(/globalThis\.__WILDSHARD_DEVSERVER__\s*=\s*(true|false)\s*;/gu)) {
          stamps++; if (match[1] !== 'false') throw new Error('Production bundle contains a DEVSERVER runtime flag');
        }
        if (code.includes('__DEVSERVER__')) throw new Error('Production bundle contains an unsubstituted DEVSERVER define');
      }
    }
  };
  walk(directory);
  if (stamps === 0) throw new Error('Production bundle is missing the DEVSERVER runtime stamp');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assertProductionBuild(resolve(process.argv[2] ?? 'dist'));
  console.info('check-devserver: production define and runtime stamps are false');
}
