import type {AudioData} from '@wildshard/format/audio';
import type {TilingReport} from '../tile-bake-report.mjs';
import type {Page} from 'playwright';

export interface PlotCamera {eye:[number,number,number];look:[number,number,number];fov:number;viewport:[number,number]}
export interface PixelRegion {left:number;top:number;width:number;height:number}
export interface AudioTemplate {
  protocol:string;idea:string;activation:string;manifest:{audio:{ambience:string;score:string}};audio:AudioData;
  catalogues:{music:string;sfx:string};assets:{id:string;file:string;kind:string;at?:[number,number,number]|null;generator:string}[];pending:string[];
}
export interface LifeReading {
  protocol:string;pin:string;view:string;device:string;scope:string;
  frames:{atMs:number;targetMs:number;file:string;sha256:string}[];
  sources:{id:string;region:PixelRegion;pixels:number;intervals:{fromMs:number;toMs:number;changedPixels:number;maxChannelDelta:number}[];moving:boolean}[];
  observedMotionSources:number;passesPixelCheck:boolean;
}
export interface BoardReading {protocol:string;idea:string;width:number;height:number;quality:number;bytes:number;
  provenance:{view:string;column:number;file:string;sha256:string;crop?:PixelRegion;pin?:string;camera?:PlotCamera}[]}
export function plotAudioRows(input:unknown,root?:string):Promise<AudioTemplate>;
export function captureLifeClip(page:Pick<Page,'screenshot'>,readCamera:()=>Promise<PlotCamera>,input:unknown,folder:string):Promise<LifeReading>;
export function lifeCheck(input:unknown):Promise<LifeReading>;
export function lifeSummary(reading:LifeReading):string;
export function makeComparisonBoard(input:unknown):Promise<{jpeg:Buffer;reading:BoardReading}>;
export function plotTilingReport(idea:string,root?:string):Promise<{report:TilingReport;markdown:string}>;
