import { sourceManifest } from '@wildshard/sdk/sourceManifest';
import { SOURCE } from './data/source';
import { CARD_HASH } from './data/card';
import { CARD_BYTES } from './boot/card';
import { DISCOVERY } from './data/discovery';

const data = sourceManifest(SOURCE, new Map([[CARD_HASH, CARD_BYTES]]));
// This catalogue descriptor enters the built shardfile; the mapping's optional empty-world installer is unused.
delete data.load;
// Immutable products own boot admission; catalogue descriptors carry no legacy boot hooks.
delete data.boot;
// Keep the authored name readable by the static ownership inventory as well as the pure runtime mapping.
const manifest = { ...data, ...DISCOVERY, name: SOURCE.identity.name, slug: 'blender-template' as const, shardfile: '/shardfiles/blender-template/shard.json' };
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default descriptor.
export default manifest;
