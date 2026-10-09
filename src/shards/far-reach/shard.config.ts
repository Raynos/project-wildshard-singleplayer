import { SKY_REACH_RUNTIME_COST } from './budgets';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { parseSocketLift } from '@wildshard/sdk/socketLift';
import { SKY_QUESTS } from './data/quests';
import { SKY_LEDGER } from './data/ledger';
import { SKY_ITEMS } from './data/items';
import { SKY_SPAWNS } from './data/spawns';
import { SKY_STATE } from './data/state';
import { AUDIO } from './data/audio';
import { MOVERS } from './data/movers';
import { LIFT_MODULE } from './data/liftModule';
import { BRIDGE_MODULE } from './data/bridgeModule';
import { RISING_ISLETS, isleStrips } from './world/islets';
import { ISLET_LIFTS } from './data/isletLift';

// Legacy trusted runtime retains today's geometry/spawn; SF29 binds only its audio.
// SF49-g (G99 / G183) and SF8c's socketLift: every entry meets the road over the cloud sea's void (no ground below y = 0
// anywhere at an edge), so each is a `socketLift`: the platform's socket deck, then a static approach over a stone lip
// (top y = 0, across the socket's full 8 m inner line) to the Rising Islet resting at its road stop; the islet rides its
// chains to the gate isle, whose walk strips are the onward route's playable ground. The islets and their stationary road
// gates are this shardfile's compiled `movers` (one admitted module, behaviour/islet.as); the trusted runtime installs
// exactly these rows (runtime/movers.ts). world/islets.ts is the one source of the geometry.
const base = emptyShardfile({ slug: 'far-reach', name: 'Sky Reach', author: 'Wildshard', revision: 1, seed: 6417 });
const lifts = new Map(ISLET_LIFTS.map((entry) => [entry.edge, parseSocketLift(entry.lift)]));
const wasm = (module: { hash: string; bytes: number }) => ({ hash: module.hash, kind: 'wasm', compressed: module.bytes, decoded: module.bytes, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
// oxlint-disable-next-line import/no-default-export -- The author CLI loads shard.config.ts as the project entry.
export default parseShardfile({ ...base, accent: 'pink', runtime: { entry: 'runtime/index.ts', cost: SKY_REACH_RUNTIME_COST, binds: ['quests', 'ledger', 'state', 'items', 'spawns'], spawns: SKY_SPAWNS }, audio: AUDIO,
  quests: SKY_QUESTS, ledger: SKY_LEDGER, state: SKY_STATE, items: SKY_ITEMS,
  entryways: base.entryways.map(({ edge, at, width }) => {
    const lift = lifts.get(edge); if (lift === undefined) throw new Error(`Sky Reach entry ${edge} has no Rising Islet`);
    return { edge, at, width, kind: 'socketLift' as const, lift };
  }),
  movers: MOVERS.filter((row) => row.id.startsWith('far.islet.')),
  // SF72: the winch and rope bridges' module (behaviour/bridges.as) is admitted beside the islets' so the grid admission and
  // the trusted headless runtime read the same verified bytes; the bridge rows stay the trusted runtime's (runtime/movers.ts)
  files: [wasm(BRIDGE_MODULE), wasm(LIFT_MODULE)], critical: [BRIDGE_MODULE.hash, LIFT_MODULE.hash],
  budgets: { ...base.budgets, sim: { resident: 1_000_000, compressed: LIFT_MODULE.bytes + BRIDGE_MODULE.bytes } },
  sim: { ...base.sim, scripts: [LIFT_MODULE.hash] },
  props: { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [],
    colliders: [...RISING_ISLETS.map((entry) => ({ id: `landing.${entry.edge}`, panel: null, initialActive: true, shapes: [{ ...entry.landing }] })),
      ...RISING_ISLETS.map((entry) => ({ id: `gate-isle.${entry.edge}`, panel: null, initialActive: true, shapes: isleStrips(entry.gate) }))] } });
