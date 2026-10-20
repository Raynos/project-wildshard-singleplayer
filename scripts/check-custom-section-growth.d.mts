/** Recover exact excesses and safe under-budget upper bounds from an exact-base ruler. */
export function rulerSectionBase(base:string,budgets:Record<string,number>,report:unknown):Record<string,{count:number;bytes:number}>;
/** Measure existing committed-tree products, compare and retain the passing result. */
export function checkCustomSectionGrowth(root:string,repo:string,base:string,revision:string,receipts:string):string[];
