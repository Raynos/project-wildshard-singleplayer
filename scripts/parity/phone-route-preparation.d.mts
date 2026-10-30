export interface PhonePreparation {
  engine:'simulator'|'webkit'; status:'pending'|'ready'|'failed'; wallMs:number; code:number|null; udid:string|null;
}
/** Prepare the sole named device through the normal lane, before artifact transfer. */
export function preparePhoneSimulator(path:string,engine:'simulator'|'webkit'):void;
/** Await native completion; a failed boot never silently falls back or retries. */
export function waitPhonePreparation(path:string):Promise<PhonePreparation>;
