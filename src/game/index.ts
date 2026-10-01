// The game layer's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; F6 / F9 fill it.
export const GAME_API = 1;
export type { EquipmentRow } from './equipmentTypes';
export { ShardPlugin } from './shard/plugin';
export { shardContext, type ShardContext, type GameServices, type GameRows, type GameRowMap, type BagVerbs } from './shard/context';
export { toLevelSpec } from './shard/spec';
export type { ShardManifest } from './shard/manifest';

export { progressSave, inventorySave, purseSave, ownedSave, bountySave, compendiumSave, bossesSave, elitesSave, saveSlug, shardSave } from './saves';
