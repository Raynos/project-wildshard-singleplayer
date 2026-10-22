/** CI discovers every enrolled port. A port supplies real raw AS, identical
 * authored inputs and two ABI adapters; the compiler enforces reachability.
 * Legacy families still awaiting adapters are not claimed as dual-admitted. */
import { expect,test } from 'vitest';
import { compileDualScriptV2 } from '../src/sdk/bake/compileDualScriptV2';
import { compileScript } from '../src/sdk/bake/compileScript';
import type { DualPortFixture } from './fixtures/script-v2-port';

const ports = import.meta.glob<DualPortFixture>('./fixtures/script-v2-ports/*.dual.ts',{ eager: true,import: 'port' });

test('the CI port discovery cannot silently become empty',() => { expect(Object.keys(ports).length).toBeGreaterThan(0); });
for (const [path,port] of Object.entries(ports)) test(`dual-admit real authored closure: ${path}`,async () => {
  const input = port.input, pair = await compileDualScriptV2(input);
  // A candidate compile cannot leak compiler state into the shipping compiler.
  expect(await compileScript(input.legacy.source,{ abi: 1,maximumPages: input.pages,sources: { ...Object.fromEntries(input.authored),...input.legacy.sources } })).toEqual(pair.legacy.bytes);
  expect(pair.authors.map(row => row.path)).toEqual([...input.authored.keys()].sort());
  await port.verify(pair);
});
