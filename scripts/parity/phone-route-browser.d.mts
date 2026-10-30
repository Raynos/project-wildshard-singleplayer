import type {PhonePage,PhoneDocument} from './phone-route.mjs';
import type {Inspector} from '../soak/inspector.mjs';

export function phoneBootstrap(paintScript:string,visit?:string):string;
export function phoneDocumentMatches(value:unknown,url:string,previous:PhoneDocument):boolean;
export function phonePageTarget(list:unknown,url:string):{url:string;webSocketDebuggerUrl:string}|undefined;
export function openPhoneBrowser(engine:string,base:string,out:string):Promise<PhonePage>;
/** Capture the real native WebKit viewport within the original ten-second cap. */
export function captureNativePhonePage(inspector:Pick<Inspector,'send'>,path:string):Promise<Buffer>;
