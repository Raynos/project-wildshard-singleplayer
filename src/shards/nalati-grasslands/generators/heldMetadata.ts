import profile from '../data/weaponPowers.json' with { type: 'json' };
import stealth from '../data/stealth.json' with { type: 'json' };

interface HeldSourceProgram {
  script: { module: string; pages: number };
  bytes: string;
  v2: { artifact: { hash: string; pages: number; ioBytes: number } };
}
interface HeldSourceInput { program: HeldSourceProgram; compiled: CompiledHeldProgram }
export type NalatiHeldRows = ReturnType<typeof nalatiHeldMetadata<HeldSourceProgram>>;

function record(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
function count(input: unknown, minimum: number): input is number {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= minimum;
}
function hash(input: unknown): input is string {
  return typeof input === 'string' && /^[a-f0-9]{64}$/u.test(input);
}
function heldSource(input: unknown): input is HeldSourceInput {
  if (!record(input)) return false;
  const program = input['program'], compiled = input['compiled'];
  if (!record(program) || !record(compiled)) return false;
  const script = program['script'], projection = program['v2'];
  if (!record(script) || !record(projection)) return false;
  const artifact = projection['artifact'];
  return record(artifact) && typeof program['bytes'] === 'string'
    && typeof script['module'] === 'string' && count(script['pages'], 1)
    && hash(artifact['hash']) && count(artifact['pages'], 1) && count(artifact['ioBytes'], 0)
    && typeof compiled['source'] === 'string' && count(compiled['bytes'], 1) && hash(compiled['hash']);
}

interface CompiledHeldProgram {
  readonly source: string;
  readonly bytes: number;
  readonly hash: string;
}
type Signal = 'polearm' | 'blade' | 'power';
interface HeldMetadata<Program> {
  held: typeof profile & {
    program: Program;
    programs: Record<Signal, Program & { signal: Signal }>;
    compiled: CompiledHeldProgram;
  };
  stealth: typeof stealth & { program: Program };
}

/** Compose original held and stealth documents from an admitted caller-owned program.
 * No compiler, generated metadata, filesystem or publication is needed here. */
export function nalatiHeldMetadata<Program extends { readonly script: unknown; readonly bytes: string }>(program: Program, compiled: CompiledHeldProgram): HeldMetadata<Program> {
  return {
    held: {
      ...structuredClone(profile),
      program: structuredClone(program),
      programs: {
        polearm: { ...structuredClone(program), signal: 'polearm' },
        blade: { ...structuredClone(program), signal: 'blade' },
        power: { ...structuredClone(program), signal: 'power' },
      },
      compiled: { ...compiled },
    },
    stealth: { ...structuredClone(stealth), program: structuredClone(program) },
  };
}

/** Validate native metadata in place so every original field and assignment order survives composition. */
export function nalatiHeldSource(input: unknown): NalatiHeldRows {
  if (!heldSource(input)) throw new Error('Invalid source-owned held metadata');
  return nalatiHeldMetadata(input.program, input.compiled);
}
