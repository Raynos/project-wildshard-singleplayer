// oxlint-disable-next-line import/no-nodejs-modules -- Own tiny resolver fixture only; no app build or production source writes.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact temporary fixture paths mirror the private composition layout.
import { dirname, resolve } from 'node:path';
import { build } from 'vite';
import { expect, test } from 'vitest';
import { nativeOwnerProofComposition, assertNativeOwnerProofComposition } from '../scripts/native-owner-proof-composition';

const tablePaths = ['game/boot/bytes.generated', 'game/boot/versions.generated',
  'game/systems/viewmodel/clips.generated', 'game/systems/effects/starter.generated'];

async function bundle(pre: boolean): Promise<{ code: string; files: Record<string, string> }> {
  const root = mkdtempSync(resolve('tmp/native-owner-resolver-')), files: Record<string, string> = {};
  const write = (path: string, text: string): void => { const absolute = resolve(root, path); mkdirSync(dirname(absolute), { recursive: true }); writeFileSync(absolute, text); };
  try {
    write('src/practice.ts', `export const loadBoot = () => import('./practiceBoot');\n${tablePaths.map((path, i) => `export { value as table${i} } from './${path}';`).join('\n')}`);
    write('src/practiceBoot.ts', "export const boot = 'NORMAL-PRACTICE-BOOT';");
    write('src/nativeOwnerProofBoot.ts', "export const boot = 'NATIVE-OWNER-BOOT';");
    for (const path of tablePaths) write(`src/${path}.ts`, "export const value = 'GLOBAL-TABLE';");
    const tables = new Map(tablePaths.map(path => [resolve(root, `src/${path}`), `export const value = 'PRIVATE-${path}';`]));
    const plugin = nativeOwnerProofComposition(root, tables);
    // Exact original defect: a normal-order resolver loses to Vite's filesystem resolver.
    if (!pre) delete plugin.enforce;
    const result = await build({ root, configFile: false, publicDir: false, logLevel: 'silent',
      plugins: [plugin, { name: 'record-actual-resolved-fixture', load(id) {
        if (id.startsWith(`${root}/`)) files[id.slice(root.length + 1)] = id.endsWith('/nativeOwnerProofBoot.ts') ? 'native-hash' : 'other-hash';
        return null;
      } }], build: { write: false, minify: false, lib: { entry: resolve(root, 'src/practice.ts'), formats: ['es'] } } });
    const output = Array.isArray(result) ? result[0] : result;
    if (output === undefined || !('output' in output)) throw new Error('Missing resolver fixture output');
    return { code: output.output.filter(row => row.type === 'chunk').map(row => row.code).join('\n'), files };
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('actual Vite normal-order resolver reproduces and refuses the original private composition defect', async () => {
  const result = await bundle(false);
  expect(result.code).toContain('NORMAL-PRACTICE-BOOT'); expect(result.code).toContain('GLOBAL-TABLE');
  expect(result.files['src/nativeOwnerProofBoot.ts']).toBeUndefined();
  expect(() => assertNativeOwnerProofComposition(result.files, 'native-hash'))
    .toThrow('Private proof requires exact native boot and excludes normal practice boot');
});

test('actual pre-enforced Vite resolver loads the exact native boot and all four private tables', async () => {
  const result = await bundle(true);
  expect(result.code).toContain('NATIVE-OWNER-BOOT'); expect(result.code).not.toContain('NORMAL-PRACTICE-BOOT'); expect(result.code).not.toContain('GLOBAL-TABLE');
  for (const path of tablePaths) expect(result.code).toContain(`PRIVATE-${path}`);
  expect(() => assertNativeOwnerProofComposition(result.files, 'native-hash')).not.toThrow();
  expect(() => assertNativeOwnerProofComposition(result.files, 'wrong-hash')).toThrow('Private proof requires exact native boot and excludes normal practice boot');
  for (const path of tablePaths) expect(() => assertNativeOwnerProofComposition({ ...result.files, [`src/${path}.ts`]: 'other-hash' }, 'native-hash'))
    .toThrow(`Private proof loaded an un-replaced generated table: src/${path}.ts`);
});
