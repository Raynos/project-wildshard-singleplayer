import type { StagedFiles } from './precommit-projects.mjs';
import type { RelatedSelection } from './precommit-selection.mjs';

export interface GateSelection {
  tests: string[];
  projects: string[];
  products: string[];
  touchedProducts: string[];
  generators: string[];
  related: RelatedSelection;
  wide: boolean;
}
/** Select from the candidate's imports, declared producer roots and product consumers. */
export function selectGateChecks(root: string, candidate: StagedFiles, changed: readonly string[]): GateSelection;
