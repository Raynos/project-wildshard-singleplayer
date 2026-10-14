import { defineShard } from '@wildshard/game/shard/manifest';
import { SKY_MANIFEST } from './data/manifest';

export const SKY_REACH = defineShard(SKY_MANIFEST, {
  render: async () => (await import('./look/render')).skyReachLook(),
  ktx2: () => import('./ktx2.generated'),
  roster: async () => (await import('./roster')).ROSTER, load: () => import('./plugin'),
});
// oxlint-disable-next-line import/no-default-export -- Folder discovery requires a default manifest.
export default SKY_REACH;
