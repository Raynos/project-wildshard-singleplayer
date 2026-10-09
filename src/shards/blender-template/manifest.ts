import { sourceManifest } from '@wildshard/sdk/sourceManifest';
import { SOURCE } from './data/source';
import { CARD_HASH, CARD_BYTES } from './data/card';
import { DISCOVERY } from './data/discovery';

const data = sourceManifest(SOURCE, new Map([[CARD_HASH, CARD_BYTES]]));
// This catalogue descriptor enters the built shardfile; the mapping's optional empty-world installer is unused.
delete data.load;
// Keep the authored name readable by the static ownership inventory as well as the pure runtime mapping.
const manifest = { ...data, ...DISCOVERY, name: SOURCE.identity.name, slug: 'blender-template' as const, shardfile: '/shardfiles/blender-template/shard.json' };
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default descriptor.
export default manifest;
