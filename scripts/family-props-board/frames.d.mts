import type {JSHandle} from 'playwright';
import type {ByteSinkPage} from '../bake-output.mjs';
/** Save native snapshots and retire all owned handles/routes on failure too. */
export function saveBoardFrames<T extends {before:HTMLCanvasElement;after:HTMLCanvasElement;reference:HTMLCanvasElement}>(page:ByteSinkPage,handle:JSHandle<T>,files:{before:string;after:string;reference:string}):Promise<Omit<T,'before'|'after'|'reference'>>;
