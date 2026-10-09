import { bindPlayerEffects as platformBindPlayerEffects } from '@wildshard/engine/combat/effects/EffectService';
import { STARTER_EFFECTS as platformStarterEffects } from '@wildshard/game/systems/effects/starter';

/** Independent status-effect movement channels, separate from equipment and traversal multipliers. */
export type StatusMovement = Parameters<typeof platformBindPlayerEffects>[0]['movement'];
/** Scope-owned platform binding for status movement, periodic damage and death cleanup; installs only when called. */
export const bindPlayerEffects: typeof platformBindPlayerEffects = platformBindPlayerEffects;

/** Starter tuning derived from the build-only commons effects pack; no runtime commons dependency or automatic installation. */
export const STARTER_EFFECTS: typeof platformStarterEffects = platformStarterEffects;
