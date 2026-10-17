import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { live } from '@wildshard/engine/models/live';
import { bridgeEntry, fanEntry, keeperEntry, windmillEntry, vaneEntry } from './models/gear';
import { SKY_LIBRARY } from './world/meshes';
import rigs from './boot/rigs.generated.json' with { type: 'json' };

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry), live(bridgeEntry), live(vaneEntry), ...SKY_LIBRARY.models(rigs.models as Parameters<typeof SKY_LIBRARY.models>[0]).map(model => live(model)), live(keeperEntry)];
