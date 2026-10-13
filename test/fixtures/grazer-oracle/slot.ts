import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** A stable small integer per animal (its seed hashed), so pack members pick their own ring angles. */
export const slot = (a: Pick<AnimalSim, 'seed'>, n: number): number => Math.floor(Math.abs(Math.sin(a.seed * 12.9898 + 1.7) * 43758.5)) % n;
