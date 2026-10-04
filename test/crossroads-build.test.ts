import { build } from 'vite';
import { expect, it } from 'vitest';
import { crossroadsRigPlugin } from '../vite/crossroadsRig';
import { CROSSROADS_CONFIG } from '../src/engine/core/crossroads';

it('ships the fixed page, shared core and installed Three version without the configurable tool entry', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, rolldownOptions: { input: 'virtual:rig-fixture' } },
    plugins: [{ name: 'rig-fixture', resolveId: (id) => id === 'virtual:rig-fixture' ? id : null, load: (id) => id === 'virtual:rig-fixture' ? 'export const fixture = 1;' : null }, crossroadsRigPlugin('fixture-build')] });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Unexpected build result');
  const files = new Map(result.output.flatMap((entry) => entry.type === 'asset' ? [[entry.fileName, typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source)] as const] : []));
  expect([...files.keys()]).toEqual(expect.arrayContaining(['crossroads-rig/index.html', 'crossroads-rig/core.js', 'crossroads-rig/phone.js', 'crossroads-rig/config.js', 'crossroads-rig/three.module.js', 'crossroads-rig/three.core.js']));
  expect(files.has('crossroads-rig/rig.js')).toBe(false);
  expect(files.get('crossroads-rig/config.js')).toContain(JSON.stringify(CROSSROADS_CONFIG));
  expect(files.get('crossroads-rig/core.js')).not.toContain('URLSearchParams');
  expect(files.get('crossroads-rig/phone.js')).not.toContain('location.search');
  expect(files.get('crossroads-rig/phone.js')).toContain('iteration <= 3');
});
