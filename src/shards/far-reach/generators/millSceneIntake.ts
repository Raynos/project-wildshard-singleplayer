const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value)
  && value.every((entry: unknown) => typeof entry === 'string' && entry.length > 0 && entry.length <= 64);

/** Admit a bounded original mill envelope; the existing scene module owns format parsing. */
export function readMillSceneEnvelope(bytes: Uint8Array): { readonly recipe: unknown; readonly parts: readonly string[]; readonly cloth: readonly string[]; readonly bindings: unknown } {
  if (bytes.byteLength === 0 || bytes.byteLength > 16_384) throw new Error('Sky mill scene wire exceeds its bound');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!record(value) || Object.keys(value).length !== 1 || !record(value['MILL_SCENE'])) throw new Error('Sky mill scene envelope differs');
  const scene = value['MILL_SCENE'];
  if (Object.keys(scene).length !== 4 || !strings(scene['parts']) || !strings(scene['cloth'])) throw new Error('Sky mill scene rows differ');
  const parts = scene['parts'], cloth = scene['cloth'];
  if (parts.join('|') !== 'shaft|boss|frame|cloth-0|cloth-1|cloth-2|cloth-3'
    || cloth.join('|') !== 'cloth-0|cloth-1|cloth-2|cloth-3') throw new Error('Sky mill scene part inventory differs');
  return { recipe: scene['recipe'], parts, cloth, bindings: scene['bindings'] };
}
