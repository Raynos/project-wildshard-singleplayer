import * as v from 'valibot';
import { NpcDialogueRowSchema } from '@wildshard/format/npcs';
import { QuestGraphSchema } from '@wildshard/format/questGraph';
import { InteractionRowsSchema } from '@wildshard/format/questInteractions';

const text = v.pipe(v.string(), v.maxLength(2048)), names = v.pipe(v.array(text), v.maxLength(64));
const finite = v.pipe(v.number(), v.finite()), point = { x: finite, z: finite };
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const base = { id: text, at: v.strictObject({ poi: v.literal('world'), ...point, y: finite, yaw: finite }),
  requires: v.exactOptional(condition), lockedLabel: v.exactOptional(text), showWhen: v.exactOptional(condition),
  sets: v.exactOptional(names), toast: v.exactOptional(text) };
const table = v.strictObject({ external: names, rows: v.pipe(v.array(v.variant('kind', [
  v.strictObject({ ...base, kind: v.literal('lever'), label: text, latch: v.boolean() }),
  v.strictObject({ ...base, kind: v.literal('door'), look: v.literal('sluice'), w: finite, h: finite, latch: v.boolean(), opensWhen: condition }),
  v.strictObject({ ...base, kind: v.literal('pickup'), look: text, label: text, color: v.exactOptional(text), item: v.exactOptional(text), touch: v.exactOptional(v.boolean()) }),
  v.strictObject({ ...base, kind: v.literal('bench'), label: text }),
])), v.maxLength(256)) });
const rows = v.strictObject({ table, graph: QuestGraphSchema, interactions: InteractionRowsSchema,
  readings: v.strictObject({ speakers: v.record(text, NpcDialogueRowSchema), continuation: v.strictObject({ bare: text, wrapped: names }) }),
  policy: v.strictObject({ resinCount: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(64)), resinFlag: text, tokenFlag: text, tokenNames: names,
    readingDelay: v.pipe(finite, v.minValue(0)), lanternIds: v.strictObject({ pond: text, ridge: text, den: text }) }),
  events: v.unknown(), deaths: v.unknown(), pageDeaths: v.unknown(), content: v.unknown(),
  beats: v.record(text, v.strictObject({ adds: names, flags: names, at: v.picklist(['ranger', 'deck', 'launch', 'lodge', 'xz']),
    ...point, look: v.strictObject(point), night: v.exactOptional(v.boolean()), day: v.exactOptional(v.boolean()) })),
});
/** Admit immutable content before either original quest host installs effects; effect hosts validate their own rows. */
export function parsePineQuestRows(input: unknown): v.InferOutput<typeof rows> {
  return v.parse(rows, input);
}
/** Shared content contract for the existing page and renderer-free native owners. */
export type PineQuestRows = v.InferOutput<typeof rows>;
