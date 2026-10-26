import { PAID_FLAG } from './rows/signalQuest';

/** The original read-only reward seed; the declared flag is the sole writer. */
export const SIGNAL_PERSISTENCE: { readonly reward: { readonly kind: "flag"; readonly key: "sunscar.signal.paid"; readonly legacy: "sunscar.signal"; }; } = { reward: { kind: 'flag', key: PAID_FLAG, legacy: 'sunscar.signal' } } as const;
