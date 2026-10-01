import type {BrowserContext} from 'playwright';

export function installInit(context:BrowserContext,meta:{lane:string;sha:string;browser:string;capture?:number|null}):Promise<void>;
declare global {
  interface Window {
    __sc_gl:()=>{texBytes:number;rbBytes:number;bufBytes:number}[];
    __parity:{cpu:number;on:boolean;rawRAF:typeof requestAnimationFrame;free:boolean;remaining:number;advance:(frames:number)=>Promise<void>};
  }
}
