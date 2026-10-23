import * as v from 'valibot';
import { ForagerContinuation } from '@wildshard/format/ambientLife';
import { nameBlob,type NamedBlob } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { namedJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import rows from '../data/physicsRows.json' with {type:'json'};

/** Population metadata is admitted by the existing named JSON reader. The
 * authored canopy count is part of this file's schema, not a runtime profile. */
export function nalatiPopulationMetadataBlob():NamedBlob {
  const finite=v.pipe(v.number(),v.finite()),count=rows.trees.length;
  const schema=v.strictObject({
    trees:v.pipe(v.array(v.tuple([finite,finite,v.pipe(finite,v.minValue(0))])),v.length(count)),
    tops:v.pipe(v.array(finite),v.length(count)),
    ledges:v.pipe(v.array(v.strictObject({x:finite,y:finite,z:finite,r:v.pipe(finite,v.minValue(0))})),v.maxLength(6)),
    marmots:ForagerContinuation,
  });
  const value=v.parse(schema,{trees:rows.trees,tops:rows.tops,ledges:rows.ledges,marmots:rows.marmots});
  return nameBlob('sim/population-metadata.json','json',new TextEncoder().encode(encodeCanonicalJson(value)),{jsonSchema:namedJsonSchema(schema)});
}
