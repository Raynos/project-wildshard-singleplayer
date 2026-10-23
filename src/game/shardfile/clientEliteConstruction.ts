/** Finite construction of the existing elite owner over original entered loans. */
import * as v from 'valibot';
import { DeclaredEliteEntry } from '@wildshard/engine/ai/view/eliteEntry';
import { parseEliteEntryPageRows } from '@wildshard/format/eliteEntryRows';
import { parseClientPlan } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import { clientNativeBook } from './clientNativeBook';
import { ReturnProgram } from '../population/returnProgram';
import { readSpawnScript } from '../population/spawnScript';
import { clientWildlifeState } from '../population/wildlife';
import { wildEnv } from '../population/pageGroups';
import { SceneDressing } from './sceneDressing';
import { entryOwner, lateEntryOwner, presentEntryOwner, publishEntryOwner, type EliteEntryConstruction } from './entryOwners';

/** Parsing/freezing the entry allocates no body, UI, programme instance or RNG
 * stream. Its original bind feature consumes these exact owners at play. */
export async function installClientEliteConstruction(ctx: ShardContext, input: unknown): Promise<EliteEntryConstruction> {
  const row = parseClientPlan({version: 1, features: [input]}).features[0];
  if (row?.kind !== 'elite.construct') throw new Error('Invalid elite construction feature');
  const runtime = ctx.game.runtime, world = runtime?.world, scope = ctx.scope, product = ctx.product;
  if (runtime === undefined || world === undefined || world === null || scope.disposed || scope.disposing)
    throw new Error('Elite construction requires its live original world');
  const game = world.game, construction = game.levelScope, models = entryOwner(scope, 'drawn-models', row.models);
  const weather = lateEntryOwner(scope, 'world-weather', row.weather), night = lateEntryOwner(scope, 'timed-encounters', row.night);
  const live = (): void => {
    if (scope.disposed || scope.disposing || construction.disposed || construction.disposing || ctx.scope !== scope || ctx.product !== product
      || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game || game.levelScope !== construction
      || entryOwner(scope, 'drawn-models', row.models) !== models) throw new Error('Elite construction owner left or changed');
  };
  live();
  if (presentEntryOwner(scope, 'elite-entry', row.owner) !== null) throw new Error('Elite construction owner already exists');
  const {admission} = v.parse(v.object({admission: v.unknown()}), await product.json(row.admission)); live();
  const {constants: {pageElites}} = v.parse(v.object({constants: v.object({pageElites: v.unknown()})}), await product.json(row.file)); live();
  const rows = parseEliteEntryPageRows(pageElites), program = ReturnProgram.page(admission, scope);
  const assets = clientNativeBook(ctx).decisionAssets;
  const fight = await readSpawnScript(product, row.fight, assets); live();
  const fightModule = fight.bytes === '' ? assets.get(fight.script.module.slice('blobs/wasm/'.length,-'.wasm'.length)) : undefined;
  if (fight.bytes === '' && fightModule === undefined) throw new Error('Missing prepared elite fight module');
  const ledges = SceneDressing.current(ctx).pieces.get(row.ledges.part)?.anchors[row.ledges.anchor] ?? [];
  const entry = new DeclaredEliteEntry(rows.entry, construction);
  let population: ReturnType<typeof clientWildlifeState> | undefined;
  const readPopulation = () => { live(); const current = clientWildlifeState(ctx); population ??= current;
    if (population !== current) throw new Error('Elite population owner changed'); return current; };
  const resolveWeather = () => { const rig = weather(), sky = rig.sky, storm = rig.storm;
    if (sky === null || storm === null) throw new Error('Elite weather owner is missing'); return {sky, storm, clock: sky.clock}; };
  let originalWeather: ReturnType<typeof resolveWeather> | undefined;
  const readWeather = () => { live(); const rig = weather(); originalWeather ??= resolveWeather();
    if (rig.sky !== originalWeather.sky || rig.storm !== originalWeather.storm || originalWeather.sky.clock !== originalWeather.clock)
      throw new Error('Elite weather owner changed'); return originalWeather; };
  const loan: EliteEntryConstruction = {entry, rows, construction, models, program: {id: row.program, scope: construction, value: program}, fight, ...(fightModule === undefined ? {} : {fightModule}), environment: wildEnv, ledges,
    get population() { return readPopulation(); },
    get clock() { return readWeather().clock; },
    get weather() { return readWeather().storm; },
    get patrol() { live(); return night().riders; }};
  live(); publishEntryOwner(scope, 'elite-entry', row.owner, loan); return loan;
}
