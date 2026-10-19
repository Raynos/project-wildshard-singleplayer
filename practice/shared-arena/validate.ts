import { validateOutputProduct } from '../../src/sdk/outputProduct';
/** Current, unchanged SDK cross-reference, budget, schema and byte admission for each retained product. */
export function validateArenaProducts(paths: readonly string[]): string[] {
  return paths.map(path => validateOutputProduct(path).index.build.sourceHash);
}
