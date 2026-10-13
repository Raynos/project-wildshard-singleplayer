import { bindPlayerEffects as platformBindPlayerEffects } from '@wildshard/engine/combat/effects/EffectService';
import { STARTER_EFFECTS as platformStarterEffects, installStarterEffects as platformInstallStarterEffects } from "@wildshard/game/plugin/ui";


/** Independent status-effect movement channels, separate from equipment and traversal multipliers. */
export type StatusMovement = Parameters<typeof platformBindPlayerEffects>[0]['movement'];
/** Scope-owned platform binding for status movement, periodic damage and death cleanup; installs only when called. */
export const bindPlayerEffects: typeof platformBindPlayerEffects = platformBindPlayerEffects;

/** Starter tuning generated from the game's authored status rows; no automatic installation. */
export const STARTER_EFFECTS: typeof platformStarterEffects = platformStarterEffects;

/** The status-icon row and the player-effect binding for a trusted runtime; installs only when called (SF54: out of the kit). */
export const installStarterEffects: typeof platformInstallStarterEffects = platformInstallStarterEffects;
