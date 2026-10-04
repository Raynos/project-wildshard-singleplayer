export const ROW_TYPES: Readonly<Record<string, readonly string[]>>;
export function rowFunctions(root?: string): string[];
export function compareRowFunctions(recorded: readonly string[], current: readonly string[]): { added: string[]; removed: string[] };
