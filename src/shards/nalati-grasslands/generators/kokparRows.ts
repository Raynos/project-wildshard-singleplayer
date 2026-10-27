import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { courseProgramInputs } from '@wildshard/commons/courseProgram';
import { KOKPAR } from './layout';
import { OVAL, LINE_X, HORSE_START, RIDER_START, FIELD_AT, RIDER_PITCH, SHOULDER } from './horseCourse';
import quest from '../data/questContent.json' with { type: 'json' };

type DecisionCompiler = NonNullable<ProjectGenerationContext['compileDecisionRows']>;
type CompiledRow = Awaited<ReturnType<DecisionCompiler>>['rows'][number];
/** GR6: the kokpar round program and the shared oval course law, as the retired `nalati-kokpar` job emitted them (its
 *  data/kokpar.generated.json), with the round module's bytes. */
export interface NalatiKokpar {
  readonly program: { readonly script: CompiledRow; readonly bytes: '' };
  readonly compiled: { readonly source: string; readonly bytes: number; readonly courseBytes?: number };
  readonly course: { readonly script: CompiledRow; readonly bytes: string };
  readonly home: { readonly x: number; readonly z: number };
  readonly goals: readonly { readonly x: number; readonly z: number }[];
  readonly messages: Readonly<Record<string, string>>;
}
/** The product name the round module ships under. */
export const NALATI_KOKPAR_MODULE = 'behaviour/nalati.kokpar.wasm';
/** The unchanged oval controller, admitted beside the existing return policies. */
export const NALATI_COURSE_MODULE = 'behaviour/nalati.course.wasm';

/** Build the round and course programs exactly as the retired bake did: `authored` is every behaviour/*.as source (the
 *  shard's line budget), `course` the shared course source; `compile` is the build's decision-row compiler. */
export async function nalatiKokparRows(compile: DecisionCompiler, authored: ReadonlyMap<string, string>, course: string): Promise<{ rows: NalatiKokpar; wasm: Uint8Array; courseWasm: Uint8Array }> {
  const k = KOKPAR;
  const goals = [0, Math.PI].map(t => {
    const x = Math.cos(t) * k.rx * 0.82, z = Math.sin(t) * k.rz * 0.82;
    return { x: k.x + x * Math.cos(k.rot) + z * Math.sin(k.rot), z: k.z - x * Math.sin(k.rot) + z * Math.cos(k.rot) };
  });
  if (Math.max(quest.clueFlags.length, quest.featherFlags.length, quest.featherElites.length) > 32) throw new Error('Chapter table exceeds its bounded loop');
  const fields = ['bowPower', 'bowThreshold', 'bowBaseDamage', 'bowPierce', 'bowCrush', 'bowCrushScale', 'bonded', 'argymaq', 'inside', 'king', 'tied', 'titan', 'clueStep',
    ...quest.clueFlags.map((_, i) => `clue${i}`), ...quest.featherFlags.map((_, i) => `feather${i}`),
    ...quest.featherElites.flatMap((_, i) => [`elite${i}`, `felled${i}`]), 'carrying', 'left', 'slow', 'cheer', 'warned', 'dt', 'playerX', 'playerZ', 'goatX', 'goatZ', 'mounted', 'horse', 'fast', 'practice', 'horseX', 'horseZ'];
  const channels = ['bowSun', 'bowDamage', 'carrying', 'left', 'slow', 'cheer', 'warned', 'event', 'pose', 'goal', 'warning', 'qBonded', 'qArgymaq', 'qInside', 'qKing', 'qTied', 'qTitan',
    ...quest.clueFlags.map((_, i) => `qClue${i}`), ...quest.featherFlags.flatMap((_, i) => [`qFeather${i}`, `qNotice${i}`]),
    ...quest.featherElites.map((_, i) => `qElite${i}`)], signals = ['bow', 'step', 'win', 'quest', 'carving', 'feathers'];
  const aliases = (values: readonly string[]): Record<string, string> => Object.fromEntries(values.map(name => [name, name]));
  const registry = (values: readonly string[]): Map<string, number> => new Map([...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((name, i) => [name, i + 1]));
  const row = { id: 'nalati.kokpar', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/kokpar.as',
    binding: { shard: true }, pages: 1, onFail: 'hold', on: ['signal'], tick: null, stateVersion: 1, state: [],
    params: { clues: quest.clueFlags.length, elites: quest.featherElites.length, feathers: quest.featherFlags.length, homeX: k.x, homeZ: k.z, fieldRadius: Math.max(k.rx, k.rz) + 22,
      goal0X: goals[0]?.x ?? 0, goal0Z: goals[0]?.z ?? 0, goal1X: goals[1]?.x ?? 0, goal1Z: goals[1]?.z ?? 0 },
    reads: ['field'], commands: ['channel'], fields: aliases(fields), channels: aliases(channels), signals: aliases(signals) };
  const built = await compile([row], { fields: registry(fields), channels: registry(channels), signals: registry(signals) }, authored, { asLineCeiling: 3184, singleSignal: true });
  const script = built.rows[0], blob = built.blobs[0];
  if (built.rows.length !== 1 || built.blobs.length !== 1 || script === undefined || blob === undefined) throw new Error('Missing kokpar program');
  const law = courseProgramInputs('oval', { courseRadius: OVAL.radius, courseWidth: OVAL.width, courseLine: LINE_X,
    resetX: RIDER_START.x, resetZ: RIDER_START.z, resetPitch: RIDER_PITCH, resetPrevX: (FIELD_AT.x + RIDER_START.x) - FIELD_AT.x,
    resetYaw: Math.atan2(-((FIELD_AT.x + HORSE_START.x) + SHOULDER - (FIELD_AT.x + RIDER_START.x)), -((FIELD_AT.z + HORSE_START.z) - (FIELD_AT.z + RIDER_START.z))) });
  const laws = await compile([law.row], law.registries, new Map([[law.source, course]]), law.options);
  const courseScript = laws.rows[0], courseBlob = laws.blobs[0];
  if (laws.rows.length !== 1 || laws.blobs.length !== 1 || courseScript === undefined || courseBlob === undefined) throw new Error('Missing shared course program');
  const rows: NalatiKokpar = { program: { script, bytes: '' }, compiled: { source: NALATI_KOKPAR_MODULE, bytes: blob.bytes.length, courseBytes: courseBlob.bytes.length },
    course: { script: courseScript, bytes: '' }, home: { x: k.x, z: k.z }, goals,
    messages: { '1': 'You have the goat! Into a tai-qazan — keep galloping, the riders are on you',
      '2': 'You let go of the goat — it goes back to the middle', '3': 'Off the field — the goat goes back to the middle',
      '4': 'Time! The riders take the goat back', '5': 'A rider leans in and snatches the goat back — keep moving!',
      '6': '15 seconds — find a tai-qazan!', '7': 'TAI-QAZAN! The riders roar and fling their hats — the round is yours' } };
  return { rows, wasm: blob.bytes, courseWasm: courseBlob.bytes };
}

/** The round module's original critical ABI-1 admission. */
export function kokparModuleOptions(): { critical: true; script: { abi: 1; pages: 1 } } { return { critical: true, script: { abi: 1, pages: 1 } }; }
