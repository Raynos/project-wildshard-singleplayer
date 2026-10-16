import { parseDecisionScripts, type DecisionScriptRow } from '@wildshard/format/decisionScripts';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { decisionBindingMap, type DecisionBindingMap } from '@wildshard/sdk/decisionBindingMap';

/** The engine runs the motion; Wasm only chooses when to approach or strike. */
export const BOSS_MOVES = parseActorMoves([{ id: 'template.boss.approach', kind: 'stalk', speed: 1,
  turn: 4, ground: true, above: 0, standOff: 0, ready: { kind: 'range' } }]);

/** Authoritative handles for this bounded reference binding, shared by its glue and scenario.
 * KA3 replaces the handwritten glue; KA6 consumes the same registries, never guessed alias ids. */
export const BOSS_REGISTRIES = {
  actors: new Map([['big-blob', 1]]), moves: new Map([['template.boss.approach', 1]]),
  strikes: new Map([['template.blob.bump', 1]]),
};

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
