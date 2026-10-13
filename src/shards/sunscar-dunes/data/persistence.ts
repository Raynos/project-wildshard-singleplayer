import { PAID_FLAG } from './signalQuest';

/** The original read-only reward seed; the declared flag is the sole writer. */
export const SIGNAL_PERSISTENCE = { reward: { kind: 'flag', key: PAID_FLAG, legacy: 'sunscar.signal' } } as const;
