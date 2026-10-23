import type {Scope} from '../../src/engine/app/scope';
import {ReturnProgram} from '../../src/game/population/returnProgram';
import programs from '../../src/shards/nalati-grasslands/behaviour/titan.generated.json' with {type:'json'};
import {readFileSync} from 'node:fs';

const projection=programs.wind.v2;
const modules=new Map([[projection.artifact.hash,Uint8Array.from(readFileSync('src/shards/nalati-grasslands/behaviour/pasture.generated.wasm'))]]);
const rows=[{id:'nalati.pasture.projection',module:`blobs/wasm/${projection.artifact.hash}.wasm`,side:'sim' as const,
  abi:2 as const,lane:'project' as const,pages:projection.artifact.pages,ioBytes:projection.artifact.ioBytes,
  compilerRevision:projection.artifact.compilerRevision,admissionRevision:projection.artifact.admissionRevision}];
/** Lend the real generated binary through the same scoped production API. */
export function lendNalatiPasture(owner:Scope):void { ReturnProgram.lendModules(owner,modules,rows); }
