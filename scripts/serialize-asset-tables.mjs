// Build only: explicit imports refuse missing generation rather than emitting empty banks.
import { PUBLIC_BYTES } from '../src/game/boot/bytes.generated.ts';
import { ASSET_VERSIONS } from '../src/game/boot/versions.generated.ts';
import { MUSIC_MANIFESTS, SFX_MANIFESTS } from '../src/game/boot/audio.generated.ts';
import { PACKS } from '../src/game/boot/packs.generated.ts';

process.stdout.write(JSON.stringify({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: MUSIC_MANIFESTS, sfx: SFX_MANIFESTS, packs: PACKS }));
