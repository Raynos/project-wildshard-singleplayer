import * as v from 'valibot';
import { PopulationFieldSchema } from '@wildshard/format/populationEnvironment';
import type { BakedGrid } from '@wildshard/format/bakedTerrainBytes';
import { nativeBodySchema } from '@wildshard/format/nativePhysics';
import { SpeciesSchema, type SpeciesData } from '@wildshard/format/speciesPrograms';
import type { AnimalSimSpec } from '../../src/engine/server/entities/AnimalSim';
import type { SimHost } from '../../src/engine/server/sim';
import { NativePopulationField } from '@wildshard/game/population/environment';
import { installMountedPlayer } from '@wildshard/game/riding/native';
import type { NativePopulationBootRows, NativePopulationConfig } from '../../src/game/server/riding/nativePopulation';
import { prepareProductRuntimePlan } from '../../src/game/server/shardfile/nativePlan';
import type { NativeAssemblyPorts } from '../../src/game/server/shardfile/nativeAssemblyInput';
import type { ShardProduct } from '../../src/game/shared/shardfile/shardProduct';
import { headlessAssemblyPorts, type HeadlessRuntimeInstallation, type HeadlessRuntimePlan, type PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import { nalatiEncounterDriver, validateNalatiEncounterLoans } from './nalati-encounter-loans';

/** Optional encounter intake comes from the same admitted species/body book;
 * it adds no initial body, identity or random draw. Ordinary consumers retain
 * their original boot and population rows by identity. */
export interface NalatiEncounterIntake {
  readonly species: readonly SpeciesData[];
  readonly recipes: readonly AnimalSimSpec[];
  /** Explicit existing variant-book loans; missing physical recipes only. */
  readonly borrowedKinds?: readonly string[];
  /** Only these admitted always species acquire fixed decision cadence. */
  readonly alwaysKinds?: readonly string[];
}
/** A proof's loans over the product's own world. */
export type NalatiWorldLoans = Pick<NativeAssemblyPorts<HeadlessRuntimeInstallation>, 'pastureCues' | 'observeWeather' | 'observeBindings'>;

function admitEncounters(boot: Parameters<typeof validateNalatiEncounterLoans>[0], intake: NalatiEncounterIntake): void {
  if (intake.species.length > 16 || intake.recipes.length > 64
    || new Set(intake.species.map(row => row.kind)).size !== intake.species.length
    || intake.species.some(row => Object.hasOwn(boot.species, row.kind) && intake.borrowedKinds?.includes(row.kind) !== true)
    || intake.recipes.some(row => !intake.species.some(species => species.kind === row.kind))
    || new Set(intake.recipes.map(row => `${row.kind}\0${row.variant}`)).size !== intake.recipes.length)
    throw new Error('Native encounter intake duplicates or replaces an admitted population recipe');
  validateNalatiEncounterLoans(boot, intake);
  for (const species of intake.species) v.parse(SpeciesSchema, species);
  for (const recipe of intake.recipes) {
    v.parse(nativeBodySchema('axis'), recipe);
    const species = intake.species.find(row => row.kind === recipe.kind);
    if (species === undefined || ![...species.variants, ...species.spawnOnly ?? []].some(row => row.id === recipe.variant))
      throw new Error('Native encounter recipe has no admitted species variant');
  }
}
/** The product with an encounter's species lent into its own boot and population server files. */
async function withEncounters(product: ShardProduct, intake: NalatiEncounterIntake): Promise<ShardProduct> {
  const boot = await product.json<NativePopulationBootRows>('server/boot.json'), config = await product.json<NativePopulationConfig>('server/population.json');
  admitEncounters(boot, intake);
  const kinds = intake.species.map(row => row.kind), encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  const files = new Map([['server/boot.json', encode({ ...boot, recipes: [...boot.recipes, ...intake.recipes],
    species: { ...boot.species, ...Object.fromEntries(intake.species.filter(row => !Object.hasOwn(boot.species, row.kind)).map(row => [row.kind, {
      kind: row.kind, variants: row.variants, ...(row.spawnOnly === undefined ? {} : { spawnOnly: row.spawnOnly }) }])) },
    hunt: { ...boot.hunt, ...Object.fromEntries(intake.species.map(row => [row.kind, row])) } })],
    ['server/population.json', encode({ ...config, eliteKinds: [...config.eliteKinds, ...kinds], motorKinds: [...config.motorKinds, ...kinds], driver: nalatiEncounterDriver(config.driver, intake) })]]);
  return { ...product, file: name => { const bytes = files.get(name); return bytes === undefined ? product.file(name) : Promise.resolve(bytes); } };
}
/** The world Nalati's product builds, with a proof's encounter species and loans over it. */
export async function prepareNalatiWorld(preparation: Parameters<PrepareHeadlessRuntime>[0], encounters?: NalatiEncounterIntake, loans: NalatiWorldLoans = {}): Promise<HeadlessRuntimePlan> {
  const product = encounters === undefined ? preparation.product : await withEncounters(preparation.product, encounters);
  return prepareProductRuntimePlan(product, preparation.assets, { ...headlessAssemblyPorts(preparation.rapier), ...loans });
}

/** Read the original named masks once before either direct native owner consumes them. */
export async function prepareNalatiPopulation(product: Pick<ShardProduct, 'file'>, grid: BakedGrid,
  constants: { readonly nativeField: unknown }, bake: { readonly trees: readonly (readonly [number, number, number])[]; readonly tops: readonly number[] }) {
  const pond = { file: 'data/geography-pond.bin', bytes: await product.file('data/geography-pond.bin') };
  const input = constants.nativeField, rows = v.parse(PopulationFieldSchema, input), wet = rows.world.wet;
  const wetFile = typeof wet === 'string' || typeof wet.data === 'string' ? undefined : wet.data.file;
  const wetBlock = wetFile === undefined ? undefined : { file: wetFile, bytes: await product.file(wetFile) };
  const field = new NativePopulationField(grid, input, bake.trees, bake.tops, pond, wetBlock);
  return { field, installMounted: (host: SimHost, profile: unknown) => installMountedPlayer(host, profile, pond, wetBlock) };
}
