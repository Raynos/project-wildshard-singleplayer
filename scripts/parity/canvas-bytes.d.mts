import type {JSHandle} from 'playwright';
import type {ByteSinkPage} from '../bake-output.mjs';
/** Publish native PNG bytes and always retire the canvas/Blob handles and route. */
export function saveCanvasPng(page:ByteSinkPage,canvas:Pick<JSHandle<HTMLCanvasElement>,'evaluateHandle'|'dispose'>,file:string):Promise<void>;
