import type {PhonePage} from './phone-route.mjs';

export function phoneBootstrap(paintScript:string):string;
export function phonePageTarget(list:unknown,url:string):{url:string;webSocketDebuggerUrl:string}|undefined;
export function openPhoneBrowser(engine:string,base:string,out:string):Promise<PhonePage>;
