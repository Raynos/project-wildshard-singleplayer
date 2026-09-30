/** scripts/check-models.mjs: the model contract's static check (E306 / E315 M8). */
export function areaOf(file: string): string;
/** the files already on the model contract: rule 6 fails a hand registration in one */
export const ON_CONTRACT: readonly string[];
export function checkModels(files?: Readonly<Record<string, string>>): {
  violations: string[];
  report: Record<string, Record<string, number>>;
};
