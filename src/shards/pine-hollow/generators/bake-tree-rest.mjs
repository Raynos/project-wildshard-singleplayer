import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeTreeRest } from './treeRest.ts';

const root = resolve(import.meta.dirname, '../../../..'), source = resolve(root, 'public/assets/models/pine-hollow-trees');
const variants = JSON.parse(readFileSync(resolve(source, 'trees.json'), 'utf8')).variants;
const bytes = await bakeTreeRest(new Uint8Array(readFileSync(resolve(source, 'trees.glb'))), variants);
const hash = createHash('sha256').update(bytes).digest('hex'), geometry = `/assets/pine-hollow/baked/trees-${hash}.glb`;
mkdirSync(resolve(root, 'public/assets/pine-hollow/baked'), {recursive: true});
writeFileSync(resolve(root, `public${geometry}`), bytes);
const parts = variants.flatMap(row => ['trunk','trunkLo','hi','lo','twigs','far'].map(part => `${row.name}__${part}`));
const bark = variants.flatMap(row => ['trunk','trunkLo'].map(part => `${row.name}__${part}`));
writeFileSync(resolve(root, 'src/shards/pine-hollow/data/treeRest.generated.json'), `${JSON.stringify({geometry, parts,
  channels: [{name:'aWindWeight',source:'_wind_weight',width:1},{name:'aBarkLayer',source:'_bark_layer',width:1,parts:bark}]})}\n`);
console.log(JSON.stringify({geometry,bytes:bytes.length,parts:parts.length}));
