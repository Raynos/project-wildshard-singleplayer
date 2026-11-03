import type { DomeCameras, DomeView } from '../dome-cameras.mjs';

export interface CapturePlot { slug: string; instance: string; cameras: string }
export const ALL_DOMES: string[];
export function selectDomeViews(cameras: DomeCameras, selected: readonly number[] | undefined): readonly DomeView[];
export function selectCapturePlots(value: unknown, slugs: readonly string[]): CapturePlot[];
export function readCapturePlans(target: CapturePlot, selected?: readonly string[], root?: string, pin?: string): {
  cameras: DomeCameras; file: string; sha256: string;
}[];
export function ringJunctionPlan(grid: {pitch?:number;cells:readonly {instance:string;slug:string;cell:readonly [number,number]}[]}, lattice:{x:number;z:number}): {
  anchor:{x:number;z:number;instance:null}; neighbours:{instance:string;slug:string;cell:readonly [number,number]}[];
};

export function readCaptureRegistry(pin:string, slugs:readonly string[]):CapturePlot[];
