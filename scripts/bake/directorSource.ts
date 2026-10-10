import { compileScript } from '@wildshard/sdk/compileScript';

/** Reproducible SDK bake for all three authored directors; source and compiler remain in the repository. */
export async function compileDirectorSource(source: string): Promise<{ bytes: Uint8Array; module: string }> {
  const bytes = await compileScript(source, { maximumPages: 1 });
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer);
  return { bytes, module: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') };
}
