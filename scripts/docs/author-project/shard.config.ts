import { emptyShardfile } from '@wildshard/sdk/author';
import { readScene } from '@wildshard/sdk/scene';
import { commonsRequirements } from '@wildshard/sdk/commons';
import { createCatalogue } from '@wildshard/commons/catalogue';
import { starterBagPack } from '@wildshard/commons/packs/bag';
import { buildWorld, disposeWorld } from './generators/world.ts';
import { identity as authoredIdentity } from './data/identity.ts';

/** Build-only catalogue and pinned immutable bytes; importing a pack never installs gameplay. */
export const commons = createCatalogue([starterBagPack({ credit: 'Wildshard shared starter data', licence: 'First-party' })]);
const required = commonsRequirements(commons, ['bag/starter-items']);
/** The synth CLI reads the same graph used to derive the product declaration. */
export const scene = buildWorld();
/** Stable authored identity shared by synth, product generation and saves. */
export const identity = authoredIdentity;
const base = emptyShardfile(identity);
const graph = readScene(scene); disposeWorld(scene);
const start = graph.playerStart;
if (start === null) throw new Error('Declare a PlayerStart in the retained generator');
const resident = Object.values(required.commonsCosts).reduce((sum, cost) => sum + cost.decoded + cost.gpu, 0);
const compressed = Object.values(required.commonsWire).reduce((sum, bytes) => sum + bytes, 0);

const project = {
  ...base, requires: { ...base.requires, ...required },
  budgets: { ...base.budgets, library: { resident, compressed } },
  library: required.commons.map(hash => `commons:${hash}`),
  spawn: start,
  entryways: graph.entries,
  world: { glb: 'assets/world.glb', materials: { Floor: 'pbr' }, colliders: 'mesh' },
};

// oxlint-disable-next-line import/no-default-export -- The public author CLI loads this project entry.
export default project;
