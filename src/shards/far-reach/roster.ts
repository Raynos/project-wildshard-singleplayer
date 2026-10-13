import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { live } from '@wildshard/engine/models/live';
import { bridgeEntry, fanEntry, keeperEntry, windmillEntry, vaneEntry } from './models/gear';
import { SKY_LIBRARY } from './world/meshes';
import { SKY_MODEL_SPECIMENS } from './data/rigLibrary';

export const ROSTER: Awaited<ReturnType<NonNullable<ShardManifest['roster']>>> = [live(fanEntry), live(windmillEntry), live(bridgeEntry), live(vaneEntry), ...SKY_LIBRARY.models(SKY_MODEL_SPECIMENS).map(model => live(model)), live(keeperEntry)];
