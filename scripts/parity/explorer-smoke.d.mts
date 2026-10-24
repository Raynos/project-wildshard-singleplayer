import type { Browser } from 'playwright';

export interface ExplorerCardSample {id:string;ready:boolean;pixels:number;darkShare:number}
/** Read pixels from actual already-drawn catalogue canvases. */
export function explorerCards(): ExplorerCardSample[];
/** Read the displayed catalogue's existing canvases without rendering or reading pixels. */
export function explorerState(): {fatal:(string|null)[];empty:boolean;ready:boolean;readyIds:string[]};
export function explorerCases(catalogue:readonly {slug:string;status:string;legacy:boolean;shardSelect?:boolean}[]):string[];
export function explorerFailures(cards:readonly ExplorerCardSample[]):string[];
/** Sweep one actual catalogue, retaining the completed pixel snapshot across thumbnail invalidation events. */
export function sweepExplorer(browser:Browser,base:string,slug:string,out:string):Promise<void>;
