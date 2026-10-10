import { registerOffscreenPreparation as register, type OffscreenPreparation as Preparation } from '@wildshard/engine/render/offscreenPreparation';

/** Existing offscreen material/camera/target and its current authored caster roots. */
export type OffscreenPreparation = Preparation;
/** Hand a scoped offscreen pass to the engine's sliced warm-up, without drawing or advancing the world. */
export const registerOffscreenPreparation: typeof register = register;
