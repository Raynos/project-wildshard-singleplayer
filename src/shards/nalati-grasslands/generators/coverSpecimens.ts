import * as v from 'valibot';
import { SpecimenBookSchema } from '@wildshard/format/specimenCatalogue';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { nameBlob } from '@wildshard/sdk/blobs';
import cover from '../data/cover.generated.json' with {type:'json'};
import { reinsCard } from './reinsCard';

/** The Explorer admits the prepared ambient cards and the baked reins card without a shard builder module. */
export function coverSpecimenBlobs():ReturnType<typeof nameBlob>[] {
  const reins=reinsCard().rows;
  return(['phone','desktop']as const).map(tier=>{
    const profile=cover[tier],rows=v.parse(SpecimenBookSchema,{rows:[...profile.catalogue,...reins],packed:profile.packed,materials:cover.materials});
    return nameBlob(`models/cover-${tier}.json`,'json',new TextEncoder().encode(encodeCanonicalJson(rows)),{jsonSchema:namedJsonSchema(SpecimenBookSchema)});
  });
}
