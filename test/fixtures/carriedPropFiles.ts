// oxlint-disable-next-line import/no-nodejs-modules -- Existing carried-body fixtures borrow the registered raw geometry.
import {readFileSync} from 'node:fs';

export const carriedPropBytes=Uint8Array.from(readFileSync('src/shards/nalati-grasslands/data/quest-prop.generated.bin'));
export const carriedPropFiles:ReadonlyMap<string,Uint8Array>=new Map([['models/specimens/quest-prop.bin',carriedPropBytes]]);
