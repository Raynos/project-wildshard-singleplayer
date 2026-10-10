import type { LevelContext, DebugRowSpec } from '@wildshard/engine/level/context';
import { developerToolsEnabled } from '../shard/runtimeVariant';
import { parseDirector, type DirectorData, type DirectorEvent } from './director';
import { createDirectorLane, type DirectorLane } from './directorRuntime';

const DEBUG_ROWS = [{ purpose: 'developer', id: 'shardDirectors', group: 'tools', label: 'Shard directors (data)',
  choices: [{ value: 'off', text: 'Legacy' }, { value: 'on', text: 'Script' }], initial: 'off', reload: true,
  ask: 'E435', reviewBy: '2026-10-18', note: 'SF24: default off; retired with the SF46–SF48 conversions.' }] as const;
const selections = new WeakMap<Pick<LevelContext, 'debugRow'>, Map<string, { contract: string; on: boolean }>>();

/** Data-selected debug variant, default off; the generic adapter adds no shard service coupling. */
export function directorVariant(context: Pick<LevelContext, 'debugRow'>, row: Omit<DebugRowSpec, 'change'> = DEBUG_ROWS[0]): boolean {
  if (row.initial !== 'off' || row.reload !== true || row.choices.length !== 2 || row.choices[0]?.value !== 'off' || row.choices[1]?.value !== 'on') throw new Error('Director variant must be default off and reload on change');
  const contract = JSON.stringify(row), choices = selections.get(context) ?? new Map<string, { contract: string; on: boolean }>();
  const previous = choices.get(row.id);
  if (previous !== undefined) {
    if (previous.contract !== contract) throw new Error('Conflicting director variant');
    return previous.on && (row.purpose !== 'developer' || developerToolsEnabled());
  }
  const choice = { contract, on: false }, adapters = context; // DEBUG_ROWS counts this row; the ratchet skips the adapter call
  adapters.debugRow({ ...row, change: (value) => { choice.on = value === 'on'; } });
  choices.set(row.id, choice); selections.set(context, choices);
  return choice.on && (row.purpose !== 'developer' || developerToolsEnabled());
}
/** Trusted observations and presentation recipes only; scripts decide event timing and payloads. */
export interface DirectorInstallation {
  data: DirectorData; bytes: () => Promise<Uint8Array>; seed: number; systemId: string;
  observe: () => Readonly<Record<string, number>>;
  publish: (event: DirectorEvent) => void;
  afterStep?: () => void;
  /** External callers supply their existing clock and publish lane outputs; no second fixed callback is installed. */
  clock?: 'fixed' | 'external';
  subscriptions?: readonly { key: string; subscribe: (receive: (value: number) => void) => () => void }[];
  query?: Parameters<typeof createDirectorLane>[3];
}
/** Game-owned fixed-step and scope installation; async admission never publishes into an unloaded level. */
export async function installDeclaredDirector(context: Pick<LevelContext, 'scope' | 'system'>, options: DirectorInstallation): Promise<DirectorLane> {
  const data = parseDirector(options.data);
  for (const source of options.subscriptions ?? []) if (!data.subscriptions.some((row) => row.scope === 'shard' && row.event === source.key)) throw new Error('Undeclared director input source');
  const lane = await createDirectorLane(data, await options.bytes(), options.seed, options.query);
  if (context.scope.disposed) throw new Error('Director scope left during admission');
  const scope = context.scope.child(`director:${data.id}`);
  const live = (): boolean => !scope.disposed;
  try {
    for (const source of options.subscriptions ?? []) scope.onDispose(source.subscribe((value) => { if (live()) lane.enqueue(source.key, value); }));
    for (const event of lane.step(0, options.observe())) if (live()) options.publish(event);
    if (!live()) throw new Error('Director scope left during initialization');
    if (options.clock !== 'external') context.system({ id: options.systemId, phase: 'fixed.post', run: () => {
      if (!live()) return;
      for (const event of lane.step(lane.tick + 1, options.observe())) if (live()) options.publish(event);
      if (live()) options.afterStep?.();
    } });
  } catch (error) { scope.dispose(); throw error; }
  return lane;
}
