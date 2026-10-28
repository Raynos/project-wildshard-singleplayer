// Build only: explicit imports refuse missing generation rather than emitting empty banks.
import { PUBLIC_BYTES } from '../src/game/boot/bytes.generated.ts';
import { ASSET_VERSIONS } from '../src/game/boot/versions.generated.ts';
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from '../src/game/boot/audio.generated.ts';
import { PACKS } from '../src/game/boot/packs.generated.ts';
import { SHARDS } from '../src/shards.generated.ts';
import { selectedPackTables } from './app-build/assetTables.mjs';

const common = { bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: MUSIC_MANIFESTS, sfx: SFX_MANIFESTS, packs: {} };
const bank = packs => JSON.stringify({ bytes: {}, versions: {}, music: {}, sfx: {}, packs });
process.stdout.write(JSON.stringify({ common: JSON.stringify(common), all: bank(PACKS),
  packs: selectedPackTables(PACKS, SHARDS.map(shard => shard.slug)) }));
