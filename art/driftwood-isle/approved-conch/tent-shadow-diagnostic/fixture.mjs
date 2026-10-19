/** Exact source transform, not a copied engine or new product callback. */
export function practiceBootFixture(source, variant) {
  if (variant !== 'control' && variant !== 'tent') throw new Error('Only fixed control/tent entries');
  const seam = 'prepare: game => preparePracticeContent(game, product), status });';
  if (source.split(seam).length !== 2) throw new Error('Existing prepare seam changed');
  const header = "import { firstUse } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/first-use.mjs';\nimport { prepareRest } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/rest-controls.mjs';\n";
  return header + source.replace(seam, `prepare: game => { firstUse(game, '${variant}'); prepareRest(game); return preparePracticeContent(game, product); }, status });`);
}
export function assertFixture(source, fixture, variant) {
  if (fixture !== practiceBootFixture(source, variant)) throw new Error('Unreviewed host fixture delta');
}
export function assertCallOrder(start, content) {
  const sky = start.indexOf('await game.buildSky();');
  const prepare = start.indexOf('const swordOptions = await options.prepare(game);');
  const run = start.indexOf('game.start();');
  if (sky < 0 || prepare <= sky || run <= prepare || start.slice(0, prepare).includes('compileGraph('))
    throw new Error('First-use source call order changed');
  if (!content.includes('export async function preparePracticeContent(') || !content.includes('await runtimeLookMaterials('))
    throw new Error('Unchanged content preparation contract missing');
}
export function practiceEntryFixture(source, variant) {
  if (variant !== 'control' && variant !== 'tent') throw new Error('Only fixed control/tent entries');
  const seam = "await import('./practiceBoot')";
  if (source.split(seam).length !== 2) throw new Error('Existing practice entry boot import changed');
  return "import { installObservation } from '/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/observe.mjs';\nReflect.set(window, '__installConchTentObservation', installObservation);\n" +
    source.replace(seam, `await import('/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/${variant}-practiceBoot.ts')`);
}
export function practiceHtmlFixture(source, variant) {
  if (variant !== 'control' && variant !== 'tent') throw new Error('Only fixed control/tent entries');
  const seam = 'src="/src/practice.ts"';
  if (source.split(seam).length !== 2) throw new Error('Existing practice HTML entry changed');
  return source.replace(seam, `src="/art/driftwood-isle/approved-conch/tent-shadow-diagnostic/${variant}-entry.ts"`);
}
