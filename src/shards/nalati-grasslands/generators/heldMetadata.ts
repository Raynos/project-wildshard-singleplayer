import profile from '../data/weaponPowers.json' with { type: 'json' };
import stealth from '../data/stealth.json' with { type: 'json' };

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
