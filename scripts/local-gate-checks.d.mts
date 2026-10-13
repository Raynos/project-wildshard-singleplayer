export function checkChangedTypes(changed: string[]): Promise<void>;
export function budgetTests(affected: string[], timings: Record<string, number>, changed: string[]): {local: string[]; ci: string[]; predictedSeconds: number; affected: number};
