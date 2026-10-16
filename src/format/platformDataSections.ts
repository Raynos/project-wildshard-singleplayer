import * as v from 'valibot';
import { DecisionScriptsSchema, type DecisionScripts } from './decisionScripts';
import { UiStringsSchema, type UiStrings } from './uiStrings';
import { WorldPhysicsSchema, type WorldPhysics } from './worldPhysics';

/** New plain-value sections supplement the unchanged v1 model assembled from the older section envelopes. */
export interface PlatformDataSections {
  'sim/scripts': DecisionScripts;
  'ui/strings': UiStrings;
  'world/physics': WorldPhysics;
}

/** Defining parsers for the first independently authored platform sections. */
export const PLATFORM_DATA_SECTIONS = {
  'sim/scripts': { schema: DecisionScriptsSchema },
  'ui/strings': { schema: UiStringsSchema },
  'world/physics': { schema: WorldPhysicsSchema },
} as const;

/** An explicitly declared new platform-section name; no shard-private name is inferred. */
export type PlatformDataSectionName = keyof PlatformDataSections;

/** Parse the named section without treating its plain payload as fields of the v1 Shardfile. */
export function parsePlatformDataSection(name: 'sim/scripts', value: unknown): DecisionScripts;
export function parsePlatformDataSection(name: 'ui/strings', value: unknown): UiStrings;
export function parsePlatformDataSection(name: 'world/physics', value: unknown): WorldPhysics;
export function parsePlatformDataSection(name: PlatformDataSectionName, value: unknown): PlatformDataSections[PlatformDataSectionName];
export function parsePlatformDataSection(name: PlatformDataSectionName, value: unknown): PlatformDataSections[PlatformDataSectionName] {
  return v.parse(PLATFORM_DATA_SECTIONS[name].schema, value);
}
