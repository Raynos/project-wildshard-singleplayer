/** Static two-entry source fixture resolver. Build/pin authority must be supplied by the reviewed build adapter. */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { assertFixture, practiceEntryFixture, practiceHtmlFixture } from './fixture.mjs';
export function verifyEntries(root) {
  const directory=resolve(root,'art/driftwood-isle/approved-conch/tent-shadow-diagnostic');
  const read=path=>readFileSync(path,'utf8');
  for(const variant of ['control','tent']) {
    assertFixture(read(resolve(root,'src/practiceBoot.ts')),read(resolve(directory,`${variant}-practiceBoot.ts`)),variant);
    if(read(resolve(directory,`${variant}-entry.ts`))!==practiceEntryFixture(read(resolve(root,'src/practice.ts')),variant) ||
       read(resolve(directory,`${variant}.html`))!==practiceHtmlFixture(read(resolve(root,'practice.html')),variant))
      throw new Error('Unreviewed fixed-entry or HTML delta');
  }
}
export function fixtureResolver(root) {
  verifyEntries(root);
  const directory=resolve(root,'art/driftwood-isle/approved-conch/tent-shadow-diagnostic');
  const fixtures = new Set(['control','tent'].flatMap(v=>[resolve(directory,`${v}-entry.ts`),resolve(directory,`${v}-practiceBoot.ts`)]));
  return { name:'conch-first-use-exact-fixtures', enforce:'pre',
    async resolveId(source,importer) {
      if (!fixtures.has(importer) || !source.startsWith('.')) return null;
      // These are byte-checked original src files plus documented deltas. Their
      // unchanged relative imports resolve exactly as they do in the original host.
      return this.resolve(resolve(root,'src',source), importer, { skipSelf:true });
    } };
}
