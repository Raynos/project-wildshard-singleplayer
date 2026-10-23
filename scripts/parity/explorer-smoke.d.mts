export interface ExplorerCardSample {id:string;ready:boolean;pixels:number;darkShare:number}
/** Read pixels from actual already-drawn catalogue canvases. */
export function explorerCards(): ExplorerCardSample[];
export function explorerCases(catalogue:readonly {slug:string;status:string;legacy:boolean}[]):string[];
export function explorerFailures(cards:readonly ExplorerCardSample[]):string[];
