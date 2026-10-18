import * as v from 'valibot';
import { isJsonData } from './json';
import { validateGraph, type GraphIr } from './materialGraph';

const id = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u),
  v.check(value => !/^(?:gl_|vec[234]$|float$|bool$|int$|void$|return$|uniform$)/u.test(value), 'Shader identifier'));
const graph = v.pipe(v.unknown(), v.rawTransform(({ dataset, addIssue, NEVER }): GraphIr => {
  const checked = validateGraph(dataset.value);
  if (!checked.ok) { addIssue({ message: checked.errors.join('; ') }); return NEVER; }
  return checked.graph;
}));
/** One pure vec3 colour expression on a standard material. Locals preserve
 * authored rounding boundaries; layout preserves existing program source. */
export const ColourFunctionSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Colour function requires plain JSON'),
  v.strictObject({ name: id, input: id, locals: v.pipe(v.array(id), v.maxLength(32)), layout: v.picklist(['compact', 'lines', 'spaced']), graph }),
  v.check(row => {
    const input = row.graph.params?.[row.input];
    return row.graph.kind === 'material' && row.graph.model === 'unlit'
    && Object.keys(row.graph.stages).length === 1 && row.graph.stages.surface?.colour !== undefined
    && Object.keys(row.graph.stages.surface ?? {}).length === 1 && Object.keys(row.graph.params ?? {}).length === 1
    && input?.type === 'vec3' && input.bind === undefined
    && Object.keys(row.graph.arrays ?? {}).length === 0 && row.graph.effectState === undefined
    && new Set(row.locals).size === row.locals.length
    && row.locals.every(local => row.graph.nodes[local] !== undefined && local !== row.input && local !== row.name);
  }, 'One pure colour input/output and unique declared locals'));
export type ColourFunctionRow = v.InferOutput<typeof ColourFunctionSchema>;
/** Named product colour functions consumed by existing material hosts. */
export const ColourFunctionBookSchema = v.pipe(v.record(id, ColourFunctionSchema), v.maxEntries(32));
export type ColourFunctionBook = v.InferOutput<typeof ColourFunctionBookSchema>;
/** Reject code, resource inputs and unsupported stages before lowering. */
export function parseColourFunction(input: unknown): ColourFunctionRow { return v.parse(ColourFunctionSchema, input); }
