import { driftwoodWitness } from './proof/driftwood-isle/native';
import { nativeQuestParity } from './fixtures/native-quest-parity';

// Preserve regenerate-before-replay order within this shard's worker.
nativeQuestParity('driftwood-isle', mode => driftwoodWitness(mode, 270_000));
