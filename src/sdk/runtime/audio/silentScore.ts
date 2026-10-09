import { installSilentScore as platformSilentScore } from '@wildshard/game/systems/audio/silentScore';

/** Mute only this score's output until its owning scope disposes, preserving the user's other audio buses. */
export const installSilentScore: typeof platformSilentScore = platformSilentScore;
