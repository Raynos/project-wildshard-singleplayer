import * as v from 'valibot';
import { SpecimenBookSchema } from '@wildshard/format/specimenCatalogue';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { nameBlob } from '@wildshard/sdk/blobs';
import cover from '../data/cover.generated.json' with {type:'json'};
import gear from '../data/gear.generated.json' with {type:'json'};
import { reinsCard } from './reinsCard';

/** the flock's sheep: the painted model (generators/bake-model-paint.mjs) in the painted creatures' material */
const SHEEP = { key: 'sheep', model: { id: 'nalati-grasslands/sheep', name: 'Fat-tailed sheep', file: 'src/shards/nalati-grasslands/generators/coverSpecimens.ts',
  category: 'creatures', pipeline: ['trellis', 'code'], surface: 'flesh', defaults: {} }, source: { kind: 'asset', asset: {
  url: '/assets/nalati/baked/painted-models/sheep.glb', phoneUrl: '/assets/nalati/baked/painted-models/sheep.phone.glb', geometrySlot: 0, materialSlot: 0,
  material: { id: 'nalati-model:sheep|near|0.35|0.8||ffffff', family: 'painterly', rim: 0.35, bands: 0.8, floor: 0.2 } } } };

/** The Explorer admits the prepared ambient cards, the baked reins card and the sheep without a shard builder module; the
 *  gear book (one for both tiers) is the held gear's catalogue, read by the Explorer and the entered arsenal alike. */
export function coverSpecimenBlobs():ReturnType<typeof nameBlob>[] {
  const reins=reinsCard().rows,book=(name:string,input:unknown)=>nameBlob(name,'json',new TextEncoder().encode(encodeCanonicalJson(v.parse(SpecimenBookSchema,input))),{jsonSchema:namedJsonSchema(SpecimenBookSchema)});
  return[...(['phone','desktop']as const).map(tier=>book(`models/cover-${tier}.json`,{rows:[...cover[tier].catalogue,...reins,SHEEP],packed:cover[tier].packed,materials:cover.materials})),
    book('models/gear-book.json',{rows:gear.catalogue.map(({key,model,source})=>({key,model,source})),packed:gear.packed,materials:gear.materials})];
}
