// oxlint-disable-next-line import/no-nodejs-modules -- The compiler runs in plain Node, outside the test's happy-dom.
import { execFileSync } from 'node:child_process';
import * as v from 'valibot';
import type { NamedBlob } from '@wildshard/sdk/blobs';
import { SCRIPT_V2_REVISIONS } from '@wildshard/format/scriptAdmissionV2';
import { NALATI_VIEW_MODULES, nalatiViewModules } from '../../src/shards/nalati-grasslands/generators/viewPrograms';

/** GR6: Nalati's five view modules compiled from their authored sources (the retired jobs' generated wasm no longer
 *  exists): once, in a plain Node child (`nalati-view-compile.mjs`; happy-dom cannot feed the compiler's streaming), then
 *  published by the product's own `nalatiViewModules`, its cache step handing back those bytes. */
const compiled = v.parse(v.record(v.string(), v.string()), JSON.parse(execFileSync(process.execPath,
  ['--import', './scripts/bake-loader.mjs', 'test/fixtures/nalati-view-compile.mjs'], { encoding: 'utf8', maxBuffer: 1 << 26 })));
const bytesOf = (id: string): Uint8Array => {
  const text = compiled[id];
  if (text === undefined) throw new Error(`Missing compiled Nalati view ${id}`);
  return new Uint8Array(Buffer.from(text, 'base64'));
};
export const NALATI_VIEW_BLOBS: readonly NamedBlob[] = await nalatiViewModules({
  compileScriptV2: () => Promise.reject(new Error('Nalati views compile in the fixture child')),
  cached: step => Promise.resolve(new Map([['view.wasm', bytesOf(step.id.slice('view-'.length))]])),
}, SCRIPT_V2_REVISIONS);
/** One view module's compiled bytes by its id (`creature-views`, `titan-fire-view`, ...). */
export function nalatiViewBytes(id: string): Uint8Array {
  const name = NALATI_VIEW_MODULES.find(row => row.id === id)?.name, blob = NALATI_VIEW_BLOBS.find(entry => entry.file.name === name);
  if (blob === undefined) throw new Error(`Missing Nalati view ${id}`);
  return blob.bytes;
}
