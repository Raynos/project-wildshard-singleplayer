import { nalatiStrikeRows, nalatiGoldenKingPose } from './kurganRows';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { decodeBuildDeflate } from '@wildshard/sdk/bake/byteCodec';
import type { prepareNalatiSpecies, NalatiSpeciesSourceInputs } from './speciesPreparation';

const body = '/assets/nalati/baked/bodies.bin';
const metadata = ['data/bodies.json', 'behaviour/admission.generated.json'];
// Preserve the complete authored AS inventory: the existing compiler charges all source lines.
const authored = [
  'behaviour/admission.as',
  'behaviour/balbal.as',
  'behaviour/chapter.as',
  'behaviour/creatureViews.as',
  'behaviour/eliteViews.as',
  'behaviour/heldWeapons.as',
  'behaviour/herdBindings.as',
  'behaviour/herdDrive.as',
  'behaviour/herdGroup.as',
  'behaviour/herdTick.as',
  'behaviour/kokpar.as',
  'behaviour/mounts.as',
  'behaviour/mountsProject.as',
  'behaviour/pack.as',
  'behaviour/pasture.as',
  'behaviour/pastureProject.as',
  'behaviour/pastureWind.as',
  'behaviour/qara.as',
  'behaviour/qaraCharge.as',
  'behaviour/riding.as',
  'behaviour/tamingApproach.as',
  'behaviour/tamingBreak.as',
  'behaviour/tamingCoordinator.as',
  'behaviour/titan.as',
  'behaviour/titanClockFrame.as',
  'behaviour/titanCombined.as',
  'behaviour/titanCommands.as',
  'behaviour/titanFire.as',
  'behaviour/titanFireView.as',
  'behaviour/titanRules.as',
  'behaviour/titanSchedules.as',
  'behaviour/titanTrail.as',
  'behaviour/titanView.as',
  'behaviour/titanWhirlsView.as',
  'behaviour/titanWind.as',
  'behaviour/weather.as',
];
const names = ['species.json', 'boot.json', 'bodies.bin', 'held-weapons.wasm', 'held-witness.bin'];
type GuestAdmission = Parameters<typeof prepareNalatiSpecies>[3];

/** Construct and persist original species outputs through explicit build inputs, never a generated species fallback.
 * Schema admission and the retained public body locator belong to the existing product adapter. */
export async function nalatiSpeciesProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'compileReturnProjection'>,
  admitInput: (input: unknown) => NalatiSpeciesSourceInputs, admitGuest: GuestAdmission,
  bodyFile: (hash: string) => string): Promise<ReadonlyMap<string, Uint8Array>> {
  const files = await ctx.cached({ id: 'species', native: true, inputs: [body, ...metadata, ...authored] }, async inputs => {
    const required = (name: string): Uint8Array => {
      const bytes = inputs.get(name);
      if (bytes === undefined || bytes.length === 0) throw new Error(`Missing original species input: ${name}`);
      return bytes;
    };
    const text = new TextDecoder('utf-8', { fatal: true });
    const json = (name: string): unknown => JSON.parse(text.decode(required(name))) as unknown;
    const strike = nalatiStrikeRows();
    const input = admitInput({ body: json('data/bodies.json'), admission: json('behaviour/admission.generated.json'),
      strike: strike.balbal, kingPose: nalatiGoldenKingPose() });
    const lanes = decodeBuildDeflate(required(body), input.body.bytes);
    if (lanes.length % 4 !== 0) throw new Error('Creature body source is not whole words');
    const words = lanes.length / 4, raw = new Uint8Array(lanes.length);
    for (let word = 0; word < words; word++) for (let lane = 0; lane < 4; lane++) raw[word * 4 + lane] = lanes[lane * words + word] ?? 0;
    const sources = new Map(authored.map(name => [name, text.decode(required(name))]));
    const { prepareNalatiSpecies: construct } = await import('./speciesPreparation');
    const compile = ctx.compileReturnProjection;
    if (compile === undefined) throw new Error('Species source requires injected projection compilation');
    const made = await construct(raw, sources, input, admitGuest, bodyFile, compile);
    const encode = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
    return new Map([['species.json', encode(made.data)], ['boot.json', encode(made.boot)],
      ['bodies.bin', made.body.bytes], ['held-weapons.wasm', made.selected], ['held-witness.bin', made.witness]]);
  });
  if (files.size !== names.length || [...files.keys()].some(name => !names.includes(name)) || names.some(name => (files.get(name)?.length ?? 0) === 0)) {
    throw new Error('Owned species inventory differs');
  }
  return files;
}
