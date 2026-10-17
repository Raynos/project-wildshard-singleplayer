import * as v from 'valibot';
import { QuestStepRowsSchema } from '@wildshard/format/questSteps';
import { QuestLeadRowsSchema } from './stagWalk';
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
const rows = v.strictObject({ lead: QuestLeadRowsSchema, steps: QuestStepRowsSchema, table, graph: QuestGraphSchema, interactions: InteractionRowsSchema,
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

const tradeText = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const item = v.picklist(['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon']);
const tradeRow = v.strictObject({ id: tradeText, label: tradeText, short: tradeText, blurb: tradeText,
  give: v.pipe(v.array(v.strictObject({ item, n: amount })), v.minLength(1), v.maxLength(3)),
  get: v.union([v.strictObject({ bolts: amount }), v.strictObject({ ammo: v.picklist(['pitch', 'broadhead', 'cartridge', 'arrow']), n: amount }),
    v.strictObject({ skin: v.picklist(['scarback-furnace', 'hollow-ash']) })]), once: v.exactOptional(v.boolean()) });
const catalogue = v.strictObject({ goods: v.pipe(v.array(v.strictObject({ id: tradeText, name: tradeText, does: tradeText,
  icon: v.picklist(['bolt', 'rifle', 'longbow', 'crossbow']), price: v.literal(0), tile: tradeText, trade: tradeRow,
  cost: v.pipe(v.array(v.strictObject({ item, n: amount, text: tradeText })), v.minLength(1), v.maxLength(3)) })), v.minLength(1), v.maxLength(64)), lines: v.record(tradeText, tradeText) });
export type TradeCatalogue = v.InferOutput<typeof catalogue>;
export type TradeGood = TradeCatalogue['goods'][number];
export type Trade = v.InferOutput<typeof tradeRow>;
export type TradeItem = v.InferOutput<typeof item>;
/** Preflight every offer and display link before the native modal or page panel can use a row. */
export function parseTradeCatalogue(input: unknown): TradeCatalogue {
  const parsed = v.parse(catalogue, input);
  if (new Set(parsed.goods.map(g => g.id)).size !== parsed.goods.length || (Object.keys(parsed.lines).length !== item.options.length || item.options.some(id => parsed.lines[id] === undefined))
    || parsed.goods.some(g => g.id !== g.trade.id || g.cost.length !== g.trade.give.length
      || g.cost.some((c, i) => { const paid = g.trade.give[i]; return paid === undefined || c.item !== paid.item || c.n !== paid.n; }))) throw new Error('Invalid Pine trade catalogue');
  return parsed;
}

export type PineTradeSkin = 'hollow-ash' | 'scarback-furnace';
