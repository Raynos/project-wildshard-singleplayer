declare module 'virtual:wildshard-title' {
  import type { TitleManifest } from '@wildshard/game/shard/titleList';

  export const TITLE_MANIFESTS: readonly TitleManifest[];
}

declare module 'virtual:wildshard-selection' {
  import type {ShardManifest} from '@wildshard/game/shard/manifest';
  export const SHARD_LOADERS:Readonly<Record<string,()=>Promise<ShardManifest>>>;
}
