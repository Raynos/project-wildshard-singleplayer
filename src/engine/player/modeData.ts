import type { EngineMechanism } from '../level/spec';

/** Mechanisms supplied by the fixed motor modes: swim/wade and the hoverboard; ordinary walking is always present. */
export const MOTOR_MODE_MECHANISMS = ['swim', 'hover'] as const satisfies readonly EngineMechanism[];
