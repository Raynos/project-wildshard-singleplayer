/** CI discovers every enrolled port. A port supplies real raw AS, identical
 * authored inputs and two ABI adapters; the compiler enforces reachability.
 * Legacy families still awaiting adapters are not claimed as dual-admitted. */
import { expect,test } from 'vitest';
import { compileDualScriptV2 } from '../src/sdk/bake/compileDualScriptV2';
import { compileScript } from '../src/sdk/bake/compileScript';
import type { DualPortFixture } from './fixtures/script-v2-port';

const ports = import.meta.glob<DualPortFixture>('./fixtures/script-v2-ports/*.dual.ts',{ eager: true,import: 'port' });

// Enumerate real source files, not just fixtures. Matching both the scoped
// filename and exact authored text catches a new source or a stale adapter.
const scopedSources = import.meta.glob<string>([
  '../src/shards/pine-hollow/**/*.as','../src/shards/driftwood-isle/**/*.as',
],{ eager: true,query: '?raw',import: 'default' });
const families = [
  ['../src/shards/pine-hollow/','./fixtures/script-v2-ports/pine-'],
  ['../src/shards/driftwood-isle/','./fixtures/script-v2-ports/driftwood-'],
] as const;

test('scoped AS inventory refuses silently unenrolled or stale sources',() => {
  const pending = Object.entries(scopedSources).filter(([path,source]) => {
    const family = families.find(([root]) => path.startsWith(root));
    if (family === undefined) throw new Error('Unrecognized scoped AS source');
    const [root,prefix] = family;
    const virtualPath = path.slice(root.length).replace(/^behaviour\//u,'').replace(/\.as$/u,'.ts');
    return !Object.entries(ports).some(([fixture,port]) => fixture.startsWith(prefix) && port.input.authored.get(virtualPath) === source);
  }).map(([path]) => path).sort();
  // These are unfinished ports, not admitted sources: the two v0 directors
  // retain an env.query import, and H9 owns the live ABI2 bridge view module.
  // Enrolling one requires removing its pending entry; additions fail CI.
  expect(pending).toEqual([
    '../src/shards/driftwood-isle/behaviour/bridgeSway.as',
    '../src/shards/driftwood-isle/behaviour/director.as',
    '../src/shards/pine-hollow/behaviour/director.as',
  ]);
});
for (const [path,port] of Object.entries(ports)) test(`dual-admit real authored closure: ${path}`,async () => {
  const input = port.input, pair = await compileDualScriptV2(input);
  // A candidate compile cannot leak compiler state into the shipping compiler.
  expect(await compileScript(input.legacy.source,{ abi: 1,maximumPages: input.pages,sources: { ...Object.fromEntries(input.authored),...input.legacy.sources } })).toEqual(pair.legacy.bytes);
  expect(pair.authors.map(row => row.path)).toEqual([...input.authored.keys()].sort());
  await port.verify(pair);
});
