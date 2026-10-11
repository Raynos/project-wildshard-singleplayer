import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, projectRuntimeFacts, type RuntimeFacts } from '@wildshard/game/plugin/headless';
import source from '../shard.config';

/** Project the same emitting ledger into Progress; no visible feat table or second grant is invented. */
export function bindSignalFacts(ctx: Parameters<typeof bindRuntimeLedger>[0], progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined,
  instance = source.identity.slug): RuntimeFacts {
  return projectRuntimeFacts(bindRuntimeLedger(ctx, source, instance), progress);
}
