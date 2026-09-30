/** scripts/check-models.mjs: the model contract's static check (E306 / E315 M8). */
export function areaOf(file: string): string;
export function checkModels(files?: Readonly<Record<string, string>>): {
  violations: string[];
  report: Record<string, Record<string, number>>;
};
