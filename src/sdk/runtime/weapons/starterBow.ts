import { Bow as StarterBow, type BowOptions as StarterOptions, type BowWorld as StarterWorld } from '@wildshard/game/weapons/Bow';

/** Options for the trusted starter bow constructor. */
export type BowOptions = StarterOptions;
/** The one shared starter bow instance. */
export type BowInstance = StarterBow;
/** The starter bow host ports. */
export type BowWorld = StarterWorld;
/** The original starter Bow binding; all trusted callers share its identity. */
export const Bow: typeof StarterBow = StarterBow;
