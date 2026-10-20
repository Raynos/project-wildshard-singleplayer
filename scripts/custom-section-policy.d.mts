export const CUSTOM_SECTION_POLICY:'lint/custom-sections.json';
/** Refuse measured growth only when the count or byte budget is exceeded. */
export function customSectionGrowthFailures(budgets:Record<string,unknown>,before:Record<string,{count:number;bytes:number}>,after:Record<string,{count:number;bytes:number}>):string[];
/** Compare actual count/byte ceilings with an append-only adoption rise history. */
export function compareCustomSections(beforeBudgets:Record<string,unknown>,afterBudgets:Record<string,unknown>,beforePolicy:unknown,afterPolicy:unknown):string[];
