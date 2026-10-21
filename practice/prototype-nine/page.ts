import { installAppIdentity } from '../../src/engine/app/identity';
import { installAssetTables } from '../../src/engine/boot/tables';
import { installSaveEnvironment } from '../../src/engine/saves/environment';
import { WILDSHARD_IDENTITY } from '../../src/game/identity';
import { PUBLIC_BYTES } from '../../src/game/boot/bytes.generated';
import { ASSET_VERSIONS } from '../../src/game/boot/versions.generated';
import { installArenaPage } from '../shared-arena/controller';

installAppIdentity(WILDSHARD_IDENTITY);
installSaveEnvironment({ storage: () => null, persistent: () => false, persist: () => Promise.resolve(false) });
installAssetTables({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: {}, sfx: {}, packs: {} });
installArenaPage(async (canvas, status) => {
  const { bootSharedArena } = await import('./boot');
  return bootSharedArena(canvas, status);
}, { prototype: true });
