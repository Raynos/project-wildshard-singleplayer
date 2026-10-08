import { NINE_DRAGON_RUNTIME_COST } from './data/runtimeCost';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { parseSocketLift } from '@wildshard/sdk/socketLift';
import { ND_AUDIO } from './data/audio';
import { MOVERS } from './data/movers';
import { LIFT_MODULE } from './data/liftModule';
import { LIFTS, NORTH_DOOR, liftLink } from './world/liftPlan';
import { liftDeckColliders } from './world/entries';
import { northStreetEnd } from './world/colliders';

// The trusted runtime preserves today's fragment geometry; audio is selected by its declared section.
// SF8c socketLift (SF51-p, G184): the legacy "north" lantern lift (`nd.lift.n`) starts from the landing deck at z = −250,
// the format's SOUTH entry, so that entry is a `socketLift`: the platform's socket, then a static approach over the deck
// (its slab, parapets and end wall, the door's threshold flush at y = 0) to the cage resting at its road stop; the cage
// rides to the winch house, whose street face opens onto the north street's drawn end (the onward route's playable
// ground). The cage and its stationary road gate are this shardfile's compiled `movers` (one admitted module,
// behaviour/lift.as); the trusted runtime installs exactly these rows (runtime/movers.ts). world/liftPlan.ts is the one
// source of the geometry. The other three decks stay ordinary entries (Jake hasn't picked their climbs).
const base = emptyShardfile({ slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', author: 'Wildshard', revision: 1, seed: 0x9d2a });
const lift = LIFTS[0]; if (lift === undefined) throw new Error('Nine Dragon declares its lantern lift');
const DECK = 'deck.south', STREET = 'street.north-end';
const link = parseSocketLift(liftLink(lift, DECK));
const street = northStreetEnd({ door: NORTH_DOOR });
const script = { hash: LIFT_MODULE.hash, kind: 'wasm', compressed: LIFT_MODULE.bytes, decoded: LIFT_MODULE.bytes, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true };
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base,
  accent: 'iris', runtime: { entry: 'runtime/index.ts', cost: NINE_DRAGON_RUNTIME_COST }, audio: ND_AUDIO, spawn: { x: 0.95, y: 125, z: 7.5, yaw: -12 * (Math.PI / 180) },
  entryways: base.entryways.map((row) => (row.edge === 'south' ? { ...row, kind: 'socketLift' as const, lift: link } : row)),
  movers: MOVERS.filter((row) => row.id === link.mover || row.id === link.gate),
  files: [script], critical: [LIFT_MODULE.hash],
  budgets: { ...base.budgets, sim: { resident: 1_000_000, compressed: LIFT_MODULE.bytes } },
  sim: { ...base.sim, scripts: [LIFT_MODULE.hash] },
  props: { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [],
    colliders: [{ id: DECK, panel: null, initialActive: true, shapes: liftDeckColliders(lift) },
      { id: STREET, panel: null, initialActive: true, shapes: [street.floor, ...street.end] }] } });
