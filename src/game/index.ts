// The game layer's public API (GAME-NORMALIZATION 01 §0). F1's alias spike; F6 / F9 fill it.
export const GAME_API = 1;
export type { EquipmentRow } from './equipmentTypes';
export { ShardPlugin } from './shard/plugin';
export { shardContext, type ShardContext, type GameServices, type GameRows, type GameRowMap, type BagVerbs } from './shard/context';
export { toLevelSpec } from './shard/spec';
export type { ShardManifest, ShardSword, ChunkTerrain, RGB, Vec2 } from './shard/manifest';

export { progressSave, inventorySave, purseSave, ownedSave, bountySave, compendiumSave, bossesSave, elitesSave, saveSlug, shardSave } from './saves';

export type { OwnedId } from './loot/Owned';

export type { ItemId } from './Inventory';

export type { ShardRuntime } from './shard/runtime';
export { installCompendium } from './compendium/install';
export { travel, bindTravelInventory, applyTravelCarry, consumeTravelHandoff, setShardSwitcher, shardMemory, type TravelRequest, type TravelHandoff } from './travel/travel';
export { normalizeItemRow, type ItemRow, type RegisteredItemRow } from './bag/items';


export { registerItemRow } from './bag/itemCatalog';
export type { AchievementDef } from './achievements';
export type { CompendiumHost, CompendiumWallPort } from './compendium/install';

export { renderFinds } from './bag/bag';

export type { Adventure, AdventureWorld, AdvAnimal } from './quest/Adventure';
export { RewardCaption } from './quest/QuestUI';

export { registerLootTable, getLootTable, rollLoot, type LootTableRow, type LootContext } from './loot/tables';
