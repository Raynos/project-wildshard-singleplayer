/** Measured evidence used by the G292 retention policy. Unknowns never qualify for an exception. */
export interface OutputEvidence { bytes:number; seconds:number|null; darwinOnly:boolean|null; blender:boolean; frozen:boolean }
/** Committed output with exact Git size and explicit unavailable producer evidence. */
export interface InventoryRow extends OutputEvidence { path:string; generator:string|null; policy:string }
/** Policy classification; no deletion is performed. */
export function outputPolicy(row:OutputEvidence):string;
/** Recognized generated-content families and generated source markers. */
export function generatedContent(file:string,header?:string):boolean;
/** Inventory an immutable Git revision rather than the shared working tree. */
export function inventoryOutputs(root:string,revision?:string):{pin:string;rows:InventoryRow[]};
/** Render the itemized policy report. */
export function inventoryMarkdown(inventory:{pin:string;rows:InventoryRow[]}):string;
