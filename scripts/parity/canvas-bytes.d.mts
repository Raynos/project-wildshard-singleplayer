import type {JSHandle} from 'playwright';
import type {ByteSinkPage} from '../bake-output.mjs';
/** Publish native PNG bytes and always retire the canvas/Blob handles and route. */
export function saveCanvasPng(page:ByteSinkPage,canvas:Pick<JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>,file:string):Promise<void>;
/** Publish a JPEG at the caller's quality (default 0.9), retaining cleanup. */
export function saveCanvasJpeg(page:ByteSinkPage,canvas:Pick<JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>,file:string,quality?:number):Promise<void>;
/** Publish a frozen PNG snapshot and always retire its owned handle/route. */
export function savePngBlob(page:ByteSinkPage,blob:JSHandle<Blob>,file:string):Promise<void>;
