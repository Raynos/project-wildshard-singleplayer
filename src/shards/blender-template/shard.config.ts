import { emptyShardfile } from '@wildshard/sdk/author';
import { assetCost } from '@wildshard/sdk/assets';
import { SOURCE } from './data/source';
import { CARD_HASH } from './data/card';
import { CARD_BYTES } from './boot/card';
import { parseLedgerRules } from '@wildshard/sdk/ledger';
import { ROWS } from './data/rows';
import { HALL_QUEST } from './quests/hall';

const base = emptyShardfile(SOURCE.identity);
const cost = assetCost('image', CARD_BYTES);
/** Build-only source: the SDK compiles and meters this, and admits its critical bytes. */
export const behaviour = [{ id: 'door', source: 'behaviour/door.as', maximumPages: 2 }];
const project = { ...base, ...SOURCE,
  files: [{ hash: CARD_HASH, kind: 'image', compressed: CARD_BYTES.length, ...cost, dependencies: [], critical: false }],
  library: [CARD_HASH], budgets: { ...base.budgets, library: { resident: cost.decoded + cost.gpu, compressed: CARD_BYTES.length } },
  world: { glb: 'assets/world.glb', materials: { Clay: 'pbr', 'Road clay': 'pbr', 'Hall door': 'pbr' }, colliders: 'mesh',
    interactive: [{ node: 'HallDoor', id: 'blender.door', colliderId: 'blender.door.collider' }] },
  // G166 look B, a clay studio: the GLB's vertex colours carry the clay tones; a fixed mid-morning sun from the
  // south-west lights the hall door three-quarter on, a high warm/cool hemisphere keeps every shaded face readable,
  // and linear fog fades distance into the warm horizon.
  look: SOURCE.look,
  rows: ROWS, quests: HALL_QUEST,
  ledger: parseLedgerRules([{ fact: 'blender.hall', origin: { kind: 'engine', source: 'quest.complete' },
    rewards: [{ kind: 'achievement', id: 'blender.firstHall', title: 'The clay hall', threshold: 1 }] }]),
  state: { ...base.state, shared: [{ id: 101, name: 'blender.door.open', type: 'bool', privacy: 'public', default: false }] },
  hooks: { conditions: [{ id: 'blender.door.open', scope: 'shared', fieldId: 101, equals: 1 }], scenes: [{ id: 'blender.door.toggle', type: 201, value: 1 }] },
  sim: { ...base.sim, scripts: ['script:door'], scriptTickDivisor: 1,
    bindings: [{ module: 'script:door', entity: 1106943697, actorId: 'actor.player', kind: 'server' }] },
  targets: { panels: [{ panel: 'blender.door', scope: 'shared', fieldId: 101, equals: 1, visibleWhenMatched: false, colliders: ['blender.door.collider'], activeWhenMatched: false }],
    interactions: [{ id: 'blender.door.use', at: [0, 1.5, 15.6], radius: 3, label: 'Open / close door', scene: 'blender.door.toggle' }] },
  creatures: { brains: [{ id: 'blender.guardian', kind: 'pursue', awareRadius: 10, leashRadius: 12, speed: 1, returnSpeed: 2,
    stopDistance: 1.5, turnRate: 4, thinkDivisor: 3, attackCooldownTicks: 60, wanderRadius: 0, wanderEveryTicks: 420 }],
    spawns: [{ id: 'guardian.1', species: 'grey-blob', variant: 'grey', brain: 'blender.guardian', strike: 'blender.guardian.bump', seed: 55, scale: 1, at: [0, 0, 32], yaw: 0 }] },
};

// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration.
export default project;
