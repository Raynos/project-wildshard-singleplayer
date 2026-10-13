import { SKY_BOSS_STATE, ROC_FACT, ROC_ID } from './rocFight';

/** The original reward state, read-only seed and boss-to-ledger projection. */
export const SKY_PERSISTENCE = { reward: { kind: 'state', key: 'far-reach.rewarded', legacy: 'far-reach.rewarded' },
  boss: { record: SKY_BOSS_STATE, defeated: { fact: ROC_FACT, entity: ROC_ID } } } as const;
