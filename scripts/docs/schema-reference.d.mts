export interface SchemaReferenceRow {
  path: string;
  type: string;
  wrappers: { kind: string; default: string }[];
  constraints: string[];
  literal?: string;
  values?: string[];
  discriminator?: string;
}
export interface AbiReferenceRow { kind: string; name: string; parameters: string[]; result: string }
export function schemaInventory(schema: unknown): SchemaReferenceRow[];
export function abiInventory(imports: Readonly<Record<string, readonly number[]>>, exports: Readonly<Record<string, readonly number[]>>): AbiReferenceRow[];
export function renderReference(inventory: readonly SchemaReferenceRow[], abi: readonly AbiReferenceRow[], contract: Readonly<Record<string, unknown>>): string;
