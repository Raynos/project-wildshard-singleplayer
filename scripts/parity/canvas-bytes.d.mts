import type {JSHandle} from 'playwright';
import type {ByteSinkPage} from '../bake-output.mjs';
/** Publish native PNG bytes and always retire the canvas/Blob handles and route. */
export function saveCanvasPng(page:ByteSinkPage,canvas:Pick<JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>,file:string):Promise<void>;
/** Publish the original quality-0.9 playback JPEG, retaining the same cleanup. */
export function saveCanvasJpeg(page:ByteSinkPage,canvas:Pick<JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>,file:string):Promise<void>;
