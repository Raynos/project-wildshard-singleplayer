import { Bow as StarterBow, type BowOptions as StarterOptions, type BowWorld as StarterWorld } from '@wildshard/game/weapons/Bow';

/** Options for the trusted starter bow constructor. */
export type BowOptions = StarterOptions;
/** The one shared starter bow instance. */
export type BowInstance = StarterBow;
/** The starter bow host ports. */
export type BowWorld = StarterWorld;
/** Compatibility name for the original starter Bow binding; all trusted callers share its identity. */
// oxlint-disable-next-line eslint/no-redeclare -- TypeScript has separate value/type namespaces; retain the old class API while both names alias the one constructor.
export const Bow: typeof StarterBow = StarterBow;
/** Compatibility instance type for the one starter constructor. */
export type Bow = StarterBow;
