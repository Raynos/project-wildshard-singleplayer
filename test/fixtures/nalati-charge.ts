// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual named programme without a generated JSON type edge.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {parseSpawnScript,SpawnScriptRowSchema} from '../../src/format/spawnScripts';

const {compiled,...row}=v.parse(v.object({...SpawnScriptRowSchema.entries,compiled:v.object({source:v.string(),bytes:v.number()})}),
  JSON.parse(readFileSync('src/shards/nalati-grasslands/data/eliteCharge.generated.json','utf8')));
export const charge=parseSpawnScript(row);
export const chargeModule=Uint8Array.from(readFileSync(`src/shards/nalati-grasslands/${compiled.source}`));
export const chargeModuleSize=compiled.bytes;
