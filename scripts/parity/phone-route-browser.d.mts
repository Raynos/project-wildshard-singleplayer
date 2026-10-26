import type {PhonePage} from './phone-route.mjs';

export function phoneBootstrap(paintScript:string):string;
export function openPhoneBrowser(engine:string,base:string,out:string):Promise<PhonePage>;
