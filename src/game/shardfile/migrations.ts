import * as v from 'valibot';

const positive = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff));
const name = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const scalar = v.union([v.boolean(), v.pipe(v.number(), v.finite()), v.pipe(v.string(), v.maxLength(4096))]);
const fieldType = v.picklist(['bool', 'i32', 'f64', 'string']);
const scope = v.picklist(['shared', 'player']);
const savedField = v.strictObject({ id: positive, name, type: fieldType, value: scalar });
/** Stable ids and typed values are the portable part of a checkpoint; executable script memory is deliberately excluded. */
export const LogicalStateSchema = v.strictObject({ version: positive, shared: v.pipe(v.array(savedField), v.maxLength(4096)),
  players: v.pipe(v.array(v.strictObject({ actorId: name, fields: v.pipe(v.array(savedField), v.maxLength(4096)) })), v.maxLength(10000)) });
/** Detached declared state for additive or explicitly authored revision migration. */
export type LogicalState = v.InferOutput<typeof LogicalStateSchema>;
const operation = v.variant('op', [
  v.strictObject({ op: v.literal('default'), scope, field: savedField }),
  v.strictObject({ op: v.literal('rename'), scope, id: positive, name }),
  v.strictObject({ op: v.literal('drop'), scope, id: positive }),
  v.strictObject({ op: v.literal('map'), scope, id: positive, type: fieldType,
    values: v.pipe(v.array(v.strictObject({ from: scalar, to: scalar })), v.minLength(1), v.maxLength(256)), fallback: v.picklist(['keep', 'reject']) }),
]);
/** Sequential state-version rows are pure data. asHook is reserved and must remain null until an admitted AS migration ABI exists. */
export const MigrationsSchema = v.pipe(v.array(v.strictObject({ from: positive, to: positive,
  fields: v.pipe(v.array(operation), v.maxLength(256)), asHook: v.optional(v.null(), null) })), v.maxLength(64),
  v.check((rows) => new Set(rows.map((row) => row.from)).size === rows.length && rows.every((row) => row.to === row.from + 1), 'Unique consecutive migration versions'),
  v.check((rows) => rows.every((row) => {
    const keys = row.fields.map((field) => `${field.scope}/${field.op === 'default' ? field.field.id : field.id}`);
    return new Set(keys).size === keys.length && row.fields.every((field) => field.op !== 'map'
      || new Set(field.values.map((value) => JSON.stringify(value.from))).size === field.values.length);
  }), 'Unique migration fields and value sources'));
/** Author migration rows accepted by both build-time admission and browser loading. */
export type DeclaredMigrations = v.InferOutput<typeof MigrationsSchema>;
/** Target declarations supply additive defaults and constrain every migrated value. */
export interface MigrationFieldDeclaration {
  id: number; name: string; type: 'bool' | 'i32' | 'f64' | 'string'; default: number | boolean | string; min?: number | undefined; max?: number | undefined;
}
/** Parse author data and reject ambiguous steps, repeated field edits and duplicate enum/value sources. */
export function parseMigrations(input: unknown): DeclaredMigrations {
  return v.parse(MigrationsSchema, input);
}
/** Full-format admission must reject future migration steps before executing a simulation. */
export function migrationRules(rows: DeclaredMigrations, stateVersion: number): string[] {
  const parsed = v.safeParse(MigrationsSchema, rows);
  if (!parsed.success) return ['valid unambiguous migration rows'];
  return parsed.output.some((row) => row.to > stateVersion) ? ['migration target within declared state version'] : [];
}
function valueValid(field: MigrationFieldDeclaration, value: number | boolean | string): boolean {
  if (field.type === 'bool') return typeof value === 'boolean';
  if (field.type === 'string') return typeof value === 'string' && value.length <= 4096;
  return typeof value === 'number' && Number.isFinite(value) && value >= (field.min ?? -Number.MAX_VALUE) && value <= (field.max ?? Number.MAX_VALUE)
    && (field.type !== 'i32' || (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647));
}
/** Migrate a detached copy by stable ids; additions take target defaults, while rename/drop/type/value changes require author rows. Never execute author code. */
export function migrateLogicalState(input: unknown, target: { version: number; shared: readonly MigrationFieldDeclaration[]; player: readonly MigrationFieldDeclaration[] }, migrations: DeclaredMigrations = []): LogicalState {
  const state = v.parse(LogicalStateSchema, structuredClone(input)), rows = parseMigrations(migrations);
  if (!Number.isSafeInteger(target.version) || target.version < state.version || rows.some((row) => row.to > target.version)) throw new Error('Invalid migration target version');
  if (new Set(state.players.map((player) => player.actorId)).size !== state.players.length) throw new Error('Duplicate logical actor');
  const lists = (kind: 'shared' | 'player') => kind === 'shared' ? [state.shared] : state.players.map((player) => player.fields);
  for (const row of rows.filter((step) => step.from >= state.version && step.to <= target.version).sort((a, b) => a.from - b.from)) {
    for (const op of row.fields) for (const fields of lists(op.scope)) {
      const id = op.op === 'default' ? op.field.id : op.id, index = fields.findIndex((field) => field.id === id), field = fields[index];
      if (op.op === 'default') { if (field === undefined) fields.push({ ...op.field }); continue; }
      if (field === undefined) throw new Error('Migration names a missing stable field');
      if (op.op === 'drop') fields.splice(index, 1);
      else if (op.op === 'rename') field.name = op.name;
      else {
        const replacement = op.values.find((value) => value.from === field.value);
        if (replacement === undefined && op.fallback === 'reject') throw new Error('Unmapped migration value');
        field.value = replacement?.to ?? field.value; field.type = op.type;
      }
    }
  }
  const finish = (fields: LogicalState['shared'], declarations: readonly MigrationFieldDeclaration[]): LogicalState['shared'] => {
    if (new Set(fields.map((field) => field.id)).size !== fields.length || new Set(declarations.map((field) => field.id)).size !== declarations.length) throw new Error('Duplicate stable state id');
    for (const field of fields) {
      const next = declarations.find((entry) => entry.id === field.id);
      if (next === undefined || next.name !== field.name || next.type !== field.type || !valueValid(next, field.value)) throw new Error('State change requires an explicit valid migration');
    }
    return declarations.map((field) => {
      const value = fields.find((prior) => prior.id === field.id)?.value ?? field.default;
      if (!valueValid(field, value)) throw new Error('Invalid migration default');
      return { id: field.id, name: field.name, type: field.type, value };
    }).sort((a, b) => a.id - b.id);
  };
  return { version: target.version, shared: finish(state.shared, target.shared),
    players: state.players.map((player) => ({ actorId: player.actorId, fields: finish(player.fields, target.player) })) };
}
