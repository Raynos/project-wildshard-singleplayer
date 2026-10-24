// Transport the existing public byte lanes into bounded project-local blob sources; never rebake geometry here.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { byteWriter } from '../../../../scripts/bake-output.mjs';

const root=resolve(import.meta.dirname,'../../../..'),writer=byteWriter(process.argv.includes('--check'),'nalati-dressing-bakes');
for(const name of ['crags','dressing','places'])writer.put(resolve(root,`src/shards/nalati-grasslands/data/${name}.generated.bin`),
  readFileSync(resolve(root,`public/assets/nalati/baked/${name}.bin`)));
writer.finish();
