import { expect, test } from 'vitest';
import { loadConfigFromFile } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the real Node config-loader fixture.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the actual build helper from the fixture config.
import { resolve } from 'node:path';

test('the bundled Vite generator config imports discovery without loading the product builder', async () => {
  mkdirSync('tmp/vite-config-boot', { recursive: true });
  const root = mkdtempSync(resolve('tmp/vite-config-boot/discovery-'));
  try {
    const path = resolve(root, 'vite.config.ts');
    writeFileSync(path, `import * as generator from ${JSON.stringify(resolve('scripts/app-build/gen.ts'))}; export default { define: { GENERATOR_EXPORTS: JSON.stringify(Object.keys(generator).sort()) } };`);
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path, root, 'silent', undefined, 'bundle');
    expect(loaded?.config.define?.['GENERATOR_EXPORTS']).toBe(JSON.stringify([
      'artTableSource', 'assetIndex', 'assetVersionRows', 'audioTableSource',
      'bootTableSources', 'bootTransportTableSources', 'generateBootTables',
    ]));
    expect(loaded?.dependencies.some(file => /(?:build-shardfiles|bake-data-maps|gen-programs)\.mjs$/u.test(file))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the Vite Node loader computes tier facts without importing page runtime state',async()=>{
  mkdirSync('tmp/vite-config-boot',{recursive:true});
  const root=mkdtempSync(resolve('tmp/vite-config-boot/tier-'));
  try {
    const path=resolve(root,'vite.config.ts');
    writeFileSync(path,`import {bootTierProductTotals} from ${JSON.stringify(resolve('scripts/app-build/bootProductTiers.ts'))}; export default {define:{BOOT_TOTALS:JSON.stringify(bootTierProductTotals(${JSON.stringify(root)}))}};`);
    const loaded=await loadConfigFromFile({command:'build',mode:'production'},path,root,'silent',undefined,'bundle');
    expect(loaded?.config.define?.['BOOT_TOTALS']).toBe('{}');
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('the Vite bundled Node config loader reads boot facts without importing the runtime format graph', async () => {
  mkdirSync('tmp/vite-config-boot', { recursive: true });
  const root = mkdtempSync(resolve('tmp/vite-config-boot/case-'));
  try {
    const path = resolve(root, 'vite.config.ts');
    writeFileSync(path, `import { bootProductTotals } from ${JSON.stringify(resolve('scripts/app-build/bootProducts.ts'))}; export default { define: { BOOT_TOTALS: JSON.stringify(bootProductTotals(${JSON.stringify(root)})) } };`);
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path, root, 'silent', undefined, 'bundle');
    if (loaded === null || loaded.config.define === undefined) throw new Error('Config loader did not reach the build configuration');
    const value: unknown = Reflect.get(loaded.config.define, 'BOOT_TOTALS');
    expect(value).toBe('{}');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
