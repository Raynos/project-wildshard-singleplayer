import { DISCOVERY } from './data/discovery';

const manifest = { ...DISCOVERY, slug: 'blender-template' as const, shardfile: '/shardfiles/blender-template/shard.json' };
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default descriptor.
export default manifest;
