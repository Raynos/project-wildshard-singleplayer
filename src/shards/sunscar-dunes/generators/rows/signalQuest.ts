
/** Raised when the Dune Matriarch falls (combat/matriarch.ts): the quest's last step. */
export const MATRIARCH_FLAG = 'sunscar.matriarch.down';
/** Raised when every step is done. */
export const COMPLETE_FLAG = 'sunscar.complete';
/** Raised once the signal reward has paid (SF50-p: a quest flag in place of the old `sunscar.signal` shard save). */
export const PAID_FLAG = 'sunscar.signal.paid';
/** The Matriarch's record (SF50-p, in place of her old `bossesSave` entry): beaten in a fight, and her coins paid. */
export const MATRIARCH_DEFEATED_FLAG = 'sunscar.matriarch.defeated';
export const MATRIARCH_PAID_FLAG = 'sunscar.matriarch.paid';
/** The ledger facts Signal Dunes emits (SF14): the platform grants their achievements once per (shard, achievement). */
export const FACT = { signal: 'sunscar.signal', matriarch: 'sunscar.matriarch' } as const;

