import type { InputHashMemo } from './bake-input-hashes.mjs';
import type { Plugin } from 'vite';

export function installInputRecorder():void;
export function recordResolution(id:string,importer:string|undefined):void;
export function recordModuleInput(id:string):void;
export function recordBundle(result:unknown):void;
export function captureProductInputs(root:string,receipt:string,run:()=>Promise<void>):Promise<void>;
export function productInputKey(root:string,receipt:string,args:string[],memo:InputHashMemo):string|undefined;
export function productToolchainKey(root:string,memo:InputHashMemo):string;

export function inputRecorderPlugin():Plugin;
