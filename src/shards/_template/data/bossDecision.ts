import { parseDecisionScripts, type DecisionScriptRow } from '@wildshard/format/decisionScripts';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { decisionBindingMap, buildDecisionRegistries, type DecisionBindingMap } from '@wildshard/format/decisionBindings';
import { emptyShardfile } from '@wildshard/sdk/author';
import { CreaturesSchema } from '@wildshard/format/creatures';
import * as v from 'valibot';
import CREATURES from './creatures.json' with { type: 'json' };
import rowData from './rows.json' with { type: 'json' };
import { parseRows } from '@wildshard/sdk/rows';

/** The engine runs the motion; Wasm only chooses when to approach or strike. */
export const BOSS_MOVES = parseActorMoves([{ id: 'template.boss.approach', kind: 'stalk', speed: 1,
  turn: 4, ground: true, above: 0, standOff: 0, ready: { kind: 'range' } }]);

/** The same real spawn/strike catalogues are used by the product and the platform handle builder. */
const TEMPLATE_ROWS = parseRows(rowData);
export const BOSS_REGISTRIES = buildDecisionRegistries({ ...emptyShardfile({ slug: 'template', name: 'Template shard', author: 'Wildshard', revision: 2, seed: 357 }),
  creatures: v.parse(CreaturesSchema, CREATURES), rows: TEMPLATE_ROWS }, BOSS_MOVES);

export function bossDecision(module: string): DecisionScriptRow {
  const rows = parseDecisionScripts([{ id: 'template.boss.decision', abi: '1.0', side: 'sim', module,
    source: 'behaviour/boss.as', binding: { encounter: 'template.boss' }, pages: 1, onFail: 'reset',
    on: ['start', 'timer', 'threshold', 'death', 'stop'], reads: ['nearestPlayer'],
    commands: ['move', 'strike', 'stop', 'timer', 'encounter'],
    actors: { boss: 'big-blob' }, moves: { approach: 'template.boss.approach' },
    strikes: { bump: 'template.blob.bump' }, timers: ['beat'], stateVersion: 1,
    state: [{ name: 'phase', type: 'i32', default: 0, min: 0, max: 3, scope: 'binding' },
      { name: 'swingNext', type: 'bool', default: true, scope: 'binding' }],
    params: { firstBeat: 1, secondBeat: 0.5 },
  }]);
  const row = rows[0]; if (row === undefined) throw new Error('Missing Template decision');
  return row;
}

export function bossBindingMap(module: string): DecisionBindingMap { return decisionBindingMap(bossDecision(module), BOSS_REGISTRIES); }
