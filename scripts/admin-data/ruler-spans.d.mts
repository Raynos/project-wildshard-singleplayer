import type { Component, ComponentInventory, ComponentSpan } from '../shard-components.mjs';
import type { CustomSource } from '../shard-platform.mjs';

export interface RulerSpanInput {
  customSources?:CustomSource[];
  components?:ComponentInventory;
  conversion:{customRuntimeLines:number};
}
export interface RulerSpanReport {
  schema:'shard-platform-spans/1';measurement:'source';shard:string;
  total:number|null;counts:Record<Component,number>|null;
  spans:ComponentSpan[]|null;unknown:string[]|null;measurementError:string|null;
}
export function rulerSpanReports(root:string,inventory:Partial<Record<string,RulerSpanInput>>,slugs:readonly string[],measurementError:string|null):Record<string,RulerSpanReport>;
export function writeRulerSpans(directory:string,input:unknown,revision:string):void;
