import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { courseProgramInputs, type CourseProgramInputs } from '@wildshard/commons/courseProgram';
import courseSource from '@wildshard/commons/scripts/course.as?raw';
import { encodeCanonicalJson, hashImmutableBytes } from '@wildshard/sdk/immutable';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';

/** The original admitted ABI-1 course row and independently owned raw module. */
export interface NinePracticeProgram { readonly script: CourseProgramInputs['row']; readonly blob: NamedBlob }

/** Compile through the injected author capability and cache immutable bytes outside source.
 * The shared AssemblyScript is a static bundle input; its exact text and complete contract also bind the step id. */
export async function ninePracticeProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'asset' | 'compileDecisionRows'>): Promise<NinePracticeProgram> {
  const definition = courseProgramInputs('checkpoints'), text = new TextEncoder();
  const identity = hashImmutableBytes(text.encode(encodeCanonicalJson([definition.row, courseSource])));
  const files = await ctx.cached({ id: `practice-${identity}` }, async () => {
    const compiler = ctx.compileDecisionRows;
    if (compiler === undefined) throw new Error('Nine practice needs decision-row compilation');
    const built = await compiler([definition.row], definition.registries, new Map([[definition.source, courseSource]]), definition.options);
    const script = built.rows[0], blob = built.blobs[0];
    if (script === undefined || blob === undefined || built.rows.length !== 1 || built.blobs.length !== 1) throw new Error('Nine practice compiler inventory differs');
    return new Map([['practice.json', text.encode(encodeCanonicalJson({ script, bytes: '' }))], ['practice.wasm', blob.bytes]]);
  });
  const metadata = files.get('practice.json'), binary = files.get('practice.wasm');
  if (files.size !== 2 || metadata === undefined || binary === undefined) throw new Error('Nine practice cache inventory differs');
  const hash = hashImmutableBytes(binary), sourceHash = hashImmutableBytes(text.encode(courseSource)), expected = courseProgramInputs('checkpoints', {}, {
    module: `blobs/wasm/${hash}.wasm`, sourceHash,
  }).row;
  const actual: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata));
  if (encodeCanonicalJson(actual) !== encodeCanonicalJson({ script: expected, bytes: '' })) throw new Error('Nine practice contract differs');
  const blob = nameBlob('behaviour/practice.wasm', 'wasm', binary, { critical: true, script: { abi: 1, pages: expected.pages } });
  if (blob.file.path !== expected.module || ctx.asset(blob.bytes) !== hash) throw new Error('Nine practice publication differs');
  // The original compiler appends sourceHash after its complete parsed row.
  // Preserve that order for the existing noncanonical scene JSON wire too.
  return { script: { ...definition.row, module: expected.module, sourceHash }, blob };
}
