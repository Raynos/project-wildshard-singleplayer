import { compileScript } from '@wildshard/sdk/compileScript';

/** Kept SDK-driven generator for the small, metered Qara module; callers own reading/writing the source and cache. */
export async function generateQaraModule(source: string): Promise<{ readonly notice: string; readonly module: string; readonly bytes: string }> {
  const bytes = await compileScript(source, { maximumPages: 1 });
  return { notice: 'DO NOT EDIT: generated from qara.as by generators/qara.ts; qara-module.test.ts regenerates and compares every byte.',
    module: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))), byte => byte.toString(16).padStart(2, '0')).join(''), bytes: btoa(String.fromCodePoint(...bytes)) };
}
