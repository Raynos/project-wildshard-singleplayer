import {
  mistSheetsGeometry as platformMistSheetsGeometry, steamPuffsGeometry as platformSteamPuffsGeometry,
  type MistLayer as PlatformMistLayer, type MistRect as PlatformMistRect, type MistSheet as PlatformMistSheet,
} from '@wildshard/game/systems/looks/mistGeometry';

/** A mist sheet: its height, its fog band and its alpha. */
export type MistSheet = PlatformMistSheet;
/** A rectangle the sheets span. */
export type MistRect = PlatformMistRect;
/** A layer of every sheet: its offset and alpha scale. */
export type MistLayer = PlatformMistLayer;
/** Flat mist sheets across rectangles at their heights, in layers, with band and alpha per vertex (SHARD-PLATFORM M3). */
export const mistSheetsGeometry: typeof platformMistSheetsGeometry = platformMistSheetsGeometry;
/** Soft billboard puffs over points, a seed per quad (SHARD-PLATFORM M3). */
export const steamPuffsGeometry: typeof platformSteamPuffsGeometry = platformSteamPuffsGeometry;
