const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const name = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 1024 && value.every(name);

interface Binding { readonly piece: string; readonly part: string; readonly baked?: string }
interface StaticVariant {
  readonly recipe: unknown;
  readonly bindings: readonly Binding[];
  readonly fixed: {
    readonly recipe: unknown;
    readonly halo: unknown;
    readonly colliders: readonly { readonly id: string; readonly colliders: readonly unknown[] }[];
    readonly bindings: Readonly<Record<string, readonly Binding[]>>;
  };
}
/** Scene recipes and all resulting registry/material rows cross the defining world-scene parsers. */
export interface SkyStaticSceneEnvelope { readonly standalone: StaticVariant; readonly cell: StaticVariant }

function bindings(input: unknown): readonly Binding[] {
  if (!Array.isArray(input) || input.length > 1024) throw new Error('Sky static binding inventory differs');
  return input.map((row: unknown) => {
    if (!record(row) || !name(row['piece']) || !name(row['part'])
      || Object.keys(row).some(key => !['piece', 'part', 'baked'].includes(key))
      || row['baked'] !== undefined && !name(row['baked'])) throw new Error('Sky static binding differs');
    return { piece: row['piece'], part: row['part'], ...(row['baked'] === undefined ? {} : { baked: row['baked'] }) };
  });
}

function variant(input: unknown): StaticVariant {
  if (!record(input) || Object.keys(input).length !== 4 || !strings(input['models']) || !record(input['fixed'])) throw new Error('Sky static variant differs');
  const fixed = input['fixed'], contacts: unknown = fixed['colliders'], groups: unknown = fixed['bindings'];
  if (Object.keys(fixed).length !== 6 || !strings(fixed['models']) || !strings(fixed['textureOnly'])
    || !Array.isArray(contacts) || contacts.length > 1024 || !record(groups)
    || Object.keys(groups).sort().join('|') !== 'crown|early|furniture|mill') throw new Error('Sky fixed scene inventory differs');
  const colliders = contacts.map((row: unknown) => {
    if (!record(row) || Object.keys(row).length !== 2 || !name(row['id']) || !Array.isArray(row['colliders'])) throw new Error('Sky static contact envelope differs');
    const rows: readonly unknown[] = row['colliders'];
    return { id: row['id'], colliders: rows };
  });
  return { recipe: input['recipe'], bindings: bindings(input['bindings']), fixed: { recipe: fixed['recipe'], halo: fixed['halo'], colliders,
    bindings: Object.fromEntries(Object.entries(groups).map(([key, rows]) => [key, bindings(rows)])) } };
}

/** Bound the cached envelope; the consumer validates every hierarchy, contact and material before publication. */
export function readSkyStaticSceneEnvelope(bytes: Uint8Array): SkyStaticSceneEnvelope {
  if (bytes.byteLength === 0 || bytes.byteLength > 2_000_000) throw new Error('Sky static scene wire exceeds its bound');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!record(value) || Object.keys(value).sort().join('|') !== 'cell|half|standalone'
    || typeof value['half'] !== 'number' || !Number.isFinite(value['half']) || value['half'] <= 0) throw new Error('Sky static scene envelope differs');
  return { standalone: variant(value['standalone']), cell: variant(value['cell']) };
}
