import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { Material } from '@wildshard/engine/physics/surface';

/** Authored keep-out box; solid geometry is prepared offline. */
export type Box = BoxSpec & { surface?: Material; ghost?: true };
