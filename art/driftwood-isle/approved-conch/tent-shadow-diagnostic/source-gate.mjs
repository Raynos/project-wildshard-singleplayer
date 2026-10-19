/** Source-only gate. It does not mint permission, run a build, or alter older pins. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { admitConchSelectedView, buildInputs, inventory, ROOT } from '../selected-native-color-view/build.mjs';
import { verifySelectedViewCaptureIdentity } from '../selected-native-color-view/identity.mjs';
import { assertFixture, assertCallOrder } from './fixture.mjs';
import { verifyEntries } from './host-plugin.mjs';
export const DIRECTORY = 'art/driftwood-isle/approved-conch/tent-shadow-diagnostic';
export const REVIEW = 'docs/reviews/conch-tent-shadow-diagnostic.md';
export const FUTURE_PIN = 'tmp/conch-tent-shadow-attempt1/reviewed-build-pin.json';
export const FUTURE_DIST = 'tmp/conch-tent-shadow-dist-attempt1';
export function checkSource(root = ROOT) {
  const read = path => readFileSync(resolve(root,path),'utf8');
  const admitted = admitConchSelectedView(root);
  verifyEntries(root);
  for (const variant of ['control','tent']) assertFixture(read('src/practiceBoot.ts'), read(`${DIRECTORY}/${variant}-practiceBoot.ts`), variant);
  assertCallOrder(read('src/game/practiceDemo/startPracticeDemo.ts'), read('src/practiceContent.ts'));
  return { admitted, files:{ ...buildInputs(root), ...inventory(root,DIRECTORY),
    [REVIEW]:createHash('sha256').update(read(REVIEW)).digest('hex') }, buildAllowed:false };
}
export function checkOriginalHost() { return verifySelectedViewCaptureIdentity(); }
/** Pins must contain a complete exact map; additions and removals are changes too. */
export function assertExactClosure(expected, actual) {
  const canonical = value => JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
  if (!expected || !actual || canonical(expected)!==canonical(actual)) throw new Error('Exact diagnostic closure changed');
}
