import { ShaderChunk } from 'three';

/**
 * Shader edits as declared rows (SHARD-PLATFORM M3, look-family rows): a shard that re-dresses a stock material (a
 * standard material's `onBeforeCompile` patch: a triplanar rock, a moss overlay, a colour pull) lists its edits as data in
 * its own `data/` — each a piece of the stage's source found and replaced — and `editShader` applies them inside the
 * shard's `patchShader` callback. Nothing here knows a shard's look; the GLSL is the shard's.
 *
 * - An edit replaces the first occurrence of `find` in its stage with `put`, with `String.prototype.replace`'s exact
 *   semantics (so a row list builds byte for byte the source the chained `.replace` calls built: the same program).
 * - `put` may instead inline one of three's shader chunks with its own text edits (`ChunkEditRow`): e.g. the lights loop
 *   with a factor on every directional light. A text edit whose `flags` are set finds a regular expression (its source in
 *   `find`), so `'g'` replaces every match and `$1` puts a group back.
 * - Rows run in their written order, each on the source the previous row left.
 */

/** One text edit: `find` (a string, or a RegExp source when `flags` is set) replaced by `put`. */
export interface TextEditRow {
  readonly find: string;
  readonly put: string;
  /** RegExp flags: `find` is then a regular expression's source (`'g'`: every match) */
  readonly flags?: string;
}

/** Three's shader chunk `chunk` (e.g. `'lights_fragment_begin'`) with its own text edits, in their order. */
export interface ChunkEditRow {
  readonly chunk: string;
  readonly edits: readonly TextEditRow[];
}

/** One edit of a program stage: the first `find` in the `stage` source replaced by `put` (text, or an edited chunk). */
export interface ShaderEditRow {
  readonly stage: 'vertex' | 'fragment';
  readonly find: string;
  readonly put: string | ChunkEditRow;
}

/** The two sources an `onBeforeCompile` patch edits (three's `WebGLProgramParametersWithUniforms`). */
export interface ShaderStages {
  vertexShader: string;
  fragmentShader: string;
}

const CHUNKS: Readonly<Record<string, string>> = ShaderChunk;

/** `source` with one text edit applied. */
export function editText(source: string, edit: TextEditRow): string {
  return edit.flags === undefined ? source.replace(edit.find, edit.put) : source.replace(new RegExp(edit.find, edit.flags), edit.put);
}

/** The replacement text a row puts: its text, or its chunk with the chunk's edits applied in order. */
export function editPut(put: string | ChunkEditRow): string {
  if (typeof put === 'string') return put;
  const chunk = CHUNKS[put.chunk];
  if (chunk === undefined) throw new Error(`editShader: three has no shader chunk ${put.chunk}`);
  return put.edits.reduce(editText, chunk);
}

/** Applies `rows` to a program's stages in their written order (inside a `patchShader` callback). */
export function editShader(shader: ShaderStages, rows: readonly ShaderEditRow[]): void {
  for (const row of rows) {
    const put = editPut(row.put);
    if (row.stage === 'vertex') shader.vertexShader = shader.vertexShader.replace(row.find, put);
    else shader.fragmentShader = shader.fragmentShader.replace(row.find, put);
  }
}
