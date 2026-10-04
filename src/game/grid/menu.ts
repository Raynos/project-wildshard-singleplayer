import { isDev } from '@wildshard/engine/core/devMode';
import type { GridMode } from './catalogue';

declare const __DEVSERVER__: boolean;
/**
 * The main menu's two entries (SHARD-PLATFORM §3.3, G58, G61, SF21a): **Select a shard** (today's one-shard flow) and
 * **EXPERIMENTAL Wildshard** (the 3 × 3 grid). What each mode lets the player enter is the §3.3 table:
 *
 *   | mode      | Select a shard enters                        | EXPERIMENTAL Wildshard           |
 *   | shipped   | the live and early-access shards             | hidden until SF22's gates pass   |
 *   | developer | every shard, as today (Jake, G58: Select a shard is the existing flow) | shown: 5 shards + 4 templates |
 *   | DEVSERVER | every shard                                  | + the `devserver` cell, its Debug row |
 *
 * The grid's shard lists come from the grid catalogue (`singleplayer.json`), never from a shard name here.
 */

/** SF22's crossroads gates: when they pass, EXPERIMENTAL Wildshard shows to everyone, still labelled EXPERIMENTAL (G61 E1) */
export const GRID_GATES_PASSED = false;

/** The author's build-time switch (`vite build --mode devserver`, SF8c); a unit test's Node has no define, so false */
export const DEVSERVER: boolean = typeof __DEVSERVER__ === 'boolean' && __DEVSERVER__;

/** what the title is allowed to show and enter right now */
export interface MenuMode { readonly developer: boolean; readonly devserver: boolean }
export function menuMode(): MenuMode { return { developer: isDev(), devserver: DEVSERVER }; }

/** EXPERIMENTAL Wildshard is on the title only with Settings ▸ Developer on, until SF22's gates pass (G61 E1) */
export function gridEntryShown(mode: MenuMode = menuMode(), gatesPassed = GRID_GATES_PASSED): boolean {
  return gatesPassed || mode.developer;
}

/** Select a shard's ENTER WORLD, per §3.3's table: `restricted` is a card the shipped game shows locked (experimental,
 *  hidden or a `_` prototype) */
export function selectEnters(_slug: string, restricted: boolean, mode: MenuMode = menuMode()): boolean {
  // Developer mode unlocks every card, Nine Dragon included, exactly as today: Select a shard stays the existing flow (G58)
  return !restricted || mode.developer || mode.devserver;
}

/** EXPLORE WORLD: a developer tool, in Developer mode or a DEVSERVER build, for a world Select a shard can enter */
export function selectExplores(slug: string, restricted: boolean, mode: MenuMode = menuMode()): boolean {
  return (mode.developer || mode.devserver) && selectEnters(slug, restricted, mode);
}

/** The grid's assembly switches at the next grid start (A17, C23): Developer, DEVSERVER and the DEVSERVER cell's row */
export function gridMode(devserverCell: boolean, mode: MenuMode = menuMode()): GridMode {
  return { developer: mode.developer, devserver: mode.devserver, nineDragon: devserverCell };
}
