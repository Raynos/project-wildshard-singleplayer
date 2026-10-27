// GR6 (G783): the mounts / taming / riding return program and its authored rows, as the retired `nalati-riding` job
// emitted them (behaviour/riding.generated.json, .wasm and the witness): built from the authored rules, the reins, the
// marmot forager and the shard's ecology rows; the build compiles it (ridingProgram.ts), tests and tools call the same.
import data from '../data/ridingRules.json' with { type: 'json' };
import reins from '../data/reins.json' with { type: 'json' };
import forager from '../data/marmotForager.json' with { type: 'json' };
import { SEED } from './terrainSeed.ts';

/** The authored behaviour sources the program compiles from, in their original order. */
export const NALATI_RIDING_SOURCES = ['mounts', 'tamingApproach', 'tamingBreak', 'riding', 'tamingCoordinator', 'mountsProject'].map(file => `behaviour/${file}.as`);

/** The population rows (variants, flocks, forager), from the ecology rows; no compiled program is involved. */
export function nalatiRidingPopulation(ecology) {
  return { ...data.population, variants: [{ kind: ecology.species.kokbori.kind, rows: ecology.species.kokbori.variants.map(({ id, scale }) => ({ id, scale })) }],
    flocks: ecology.flocks.world.map((row, index) => ({ row: { ...row, seed: SEED + row.seed }, dog: ecology.wildlife.flocks[index]?.dog === true })),
    forager: { row: forager, seed: SEED ^ 0x6a2b } };
}

/** Compile the program (`compile`: the build's return-projection compiler) from `read(source)` texts of
 *  NALATI_RIDING_SOURCES; returns the riding rows and the module and witness bytes. */
export async function nalatiRidingRows(compile, read, ecology) {
  const canonical = name => name;
  const aliases = names => Object.fromEntries(names.map(name => [name, canonical(name)]));
  const registry = names => new Map(names.map(canonical).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((name, index) => [name, index + 1]));
  const authored = new Map(NALATI_RIDING_SOURCES.map(source => {
    const baked = read(source).replaceAll(/Params\.([A-Za-z0-9_]+)/g, (_match, key) => {
      const value = data.params[key]; if (!Number.isFinite(value)) throw new Error(`Missing mounted tuning ${key}`); return `f64(${value})`;
    }).replace(', Params', '');
    return [source, baked];
  }));
  const text = [...authored.values()].join('\n'), names = prefix => [...new Set([...text.matchAll(new RegExp(`${prefix}\\.([A-Za-z0-9_]+)`, 'g'))].map(match => match[1]))];
  const fields = names('Field'), channels = names('Channel'), signals = names('Signal');
  const row = { id: 'nalati.mounts', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/mounts.as', binding: { shard: true }, pages: 1, onFail: 'hold', on: ['signal'], tick: null,
    stateVersion: 1, state: [], params: {}, reads: ['field', 'radial'], commands: ['channel'], fields: aliases(fields), channels: aliases(channels), signals: aliases(signals) };
  const coordinator = authored.get('behaviour/tamingCoordinator.as') ?? '';
  const dual = await compile(row, { fields: registry(fields), channels: registry(channels), signals: registry(signals) }, authored, { asLineCeiling: 3184, projectSource: 'behaviour/mountsProject.as', worldActions: true,
    capture: { fields: [...new Set([...coordinator.matchAll(/set\(Field\.([A-Za-z0-9_]+)/g)].map(match => match[1]))], channels: [...new Set([...coordinator.matchAll(/out\(Channel\.([A-Za-z0-9_]+)/g)].map(match => match[1]))] }, outputCapacity: 96 });
  const program = { ...dual.legacy, bytes: '', v2: { ...dual.candidate, bytes: '' } };
  const compiled = { witnessBytes: dual.witness.length, source: 'behaviour/nalati.mounts.wasm', bytes: dual.binary.length, hash: dual.candidate.artifact.hash };
  const programs = { client: data.client, reins, population: nalatiRidingPopulation(ecology), initial: data.initial, approach: program, breaking: program, riding: program, compiled };
  return { programs, wasm: dual.binary, witness: dual.witness };
}
