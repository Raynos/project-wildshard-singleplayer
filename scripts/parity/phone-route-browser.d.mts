import type {PhonePage,PhoneDocument} from './phone-route.mjs';

export function phoneBootstrap(paintScript:string,visit?:string):string;
export function phoneDocumentMatches(value:unknown,url:string,previous:PhoneDocument):boolean;
export function phonePageTarget(list:unknown,url:string):{url:string;webSocketDebuggerUrl:string}|undefined;
export function openPhoneBrowser(engine:string,base:string,out:string):Promise<PhonePage>;
