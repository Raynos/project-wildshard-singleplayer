// oxlint-disable-next-line import/no-nodejs-modules -- Read build-only AS modules when the author compiler asks for them.
import { readFileSync } from 'node:fs';

/** Versioned build-only sources for the shared ABI setup and bridge mover; no runtime installer. */
export function bridgeScriptSources(): { version: '0.0.0'; sources: Readonly<Record<string, string>> } {
  return { version: '0.0.0', sources: {
    'commons/abi.ts': readFileSync(new URL('scripts/abi.as', import.meta.url), 'utf8'),
    'commons/bridge.ts': readFileSync(new URL('scripts/bridge.as', import.meta.url), 'utf8'),
  } };
}
