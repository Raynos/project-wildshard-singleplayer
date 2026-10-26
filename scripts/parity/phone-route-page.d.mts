import type {PhoneObservation,PhoneWall} from './phone-route.mjs';

export function phoneTouchButton(selector:string):boolean;
export function phoneRouteObservation():PhoneObservation|null;
export function watchPhoneEntry(instance:string):void;
export function phoneBoardWall(milliseconds:number):Promise<PhoneWall>;
export function installPhoneTitlePaint():void;
