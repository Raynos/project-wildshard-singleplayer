// The app identity and its asset tables, installed before any other module runs (E405 E414 / E415): index.html
// loads this as its first module script, src/native.ts and scripts/bake-loader.mjs import it first, because the
// service-worker entry, the saves and the boot read them. The tables are already in the first paint's graph.
import { installAppIdentity } from '#engine/app/identity';
import { installAssetTables } from '#engine/boot/tables';
import { WILDSHARD_IDENTITY } from '#game/identity';
import { PUBLIC_BYTES } from '#game/boot/bytes.generated';
import { ASSET_VERSIONS } from '#game/boot/versions.generated';
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from '#game/boot/audio.generated';
import { PACKS } from '#game/boot/packs.generated';

installAppIdentity(WILDSHARD_IDENTITY);
installAssetTables({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: MUSIC_MANIFESTS, sfx: SFX_MANIFESTS, packs: PACKS });
