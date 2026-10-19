/** Exact normal-clock host seam. No clock or pose overrides. */
export const DIRECTORY = 'art/driftwood-isle/approved-conch/public4-tent-candidate';
export function practiceBootFixture(source) {
  const seam = 'prepare: game => preparePracticeContent(game, product), status });';
  if (source.split(seam).length !== 2) throw new Error('Original prepare seam changed');
  return "import { firstUse } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/first-use.mjs';\n" + source.replace(seam,
    "prepare: game => { firstUse(game, 'tent'); return preparePracticeContent(game, product); }, status });");
}
export function practiceEntryFixture(source) {
  const seam = "await import('./practiceBoot')";
  if (source.split(seam).length !== 2) throw new Error('Original entry seam changed');
  return "import { installFirstUseReader } from '/" + DIRECTORY + "/first-use-reader.mjs';\ninstallFirstUseReader();\n" + source.replace(seam, `await import('/${DIRECTORY}/candidate-practiceBoot.ts')`);
}
export function practiceHtmlFixture(source) {
  const seam = 'src="/src/practice.ts"';
  if (source.split(seam).length !== 2) throw new Error('Original HTML seam changed');
  return source.replace(seam, `src="/${DIRECTORY}/candidate-entry.ts"`);
}
