import * as v from 'valibot';

/** Bounded, read-only expressions over caller-owned panel values. */
export type PanelValue = string | number | boolean | { read: string } | { concat: PanelValue[] }
  | { choose: PanelCondition; yes: PanelValue; no: PanelValue }
  | { lookup: Record<string, string | number>; key: PanelValue; fallback: string | number };
/** Comparisons do not mutate gameplay state. */
export interface PanelCondition { left: PanelValue; op: 'eq' | 'lt' | 'gte'; right: PanelValue }
/** A button delivers a named existing owner action, optionally reading a text field before closing. */
export interface PanelAction { id: string; arg?: PanelValue; input?: string; close?: boolean }
/** Markup and its finite repeated children; input and view lifetimes remain platform-owned. */
export interface PanelTemplate {
  tag?: 'div' | 'span' | 'b' | 'i' | 'small' | 'p' | 'strong' | 'em' | 'button' | 'input' | 'meter';
  cls?: PanelValue; text?: PanelValue; ref?: PanelValue; button?: 'button' | 'submit' | 'reset';
  attrs?: [string, string][]; props?: [string, PanelValue][];
  input?: { type?: string; maxLength?: number; value?: PanelValue; autocomplete?: 'off'; spellcheck?: boolean };
  when?: PanelCondition; repeat?: { source: string; as: string; index?: string };
  action?: PanelAction; children?: PanelTemplate[];
}
const text = v.pipe(v.string(), v.maxLength(4096));
const path = v.pipe(v.string(), v.regex(/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/u), v.maxLength(128),
  v.check(value => value.split('.').every(key => !['__proto__', 'constructor', 'prototype'].includes(key))));
const attribute = v.pipe(text, v.regex(/^(?:aria-[a-z-]+|data-[a-z-]+|autocapitalize|enterkeyhint|role|title)$/u));
const scalar = v.union([text, v.pipe(v.number(), v.minValue(-Number.MAX_VALUE), v.maxValue(Number.MAX_VALUE)), v.boolean()]);
const value: v.GenericSchema<unknown, PanelValue> = v.lazy(() => v.union([scalar,
  v.strictObject({ read: path }), v.strictObject({ concat: v.pipe(v.array(value), v.maxLength(32)) }),
  v.strictObject({ choose: conditionSchema(), yes: value, no: value }),
  v.strictObject({ lookup: v.record(text, v.union([text, v.number()])), key: value, fallback: v.union([text, v.number()]) }),
]));
function conditionSchema(): v.GenericSchema<unknown, PanelCondition> {
  return v.strictObject({ left: value, op: v.picklist(['eq', 'lt', 'gte']), right: value });
}
const action: v.GenericSchema<unknown, PanelAction> = v.strictObject({ id: path, arg: v.exactOptional(value), input: v.exactOptional(path), close: v.exactOptional(v.boolean()) });
const template: v.GenericSchema<unknown, PanelTemplate> = v.lazy(() => v.strictObject({
  tag: v.exactOptional(v.picklist(['div', 'span', 'b', 'i', 'small', 'p', 'strong', 'em', 'button', 'input', 'meter'])),
  cls: v.exactOptional(value), text: v.exactOptional(value), ref: v.exactOptional(value), button: v.exactOptional(v.picklist(['button', 'submit', 'reset'])),
  attrs: v.exactOptional(v.pipe(v.array(v.tuple([attribute, text])), v.maxLength(32))),
  props: v.exactOptional(v.pipe(v.array(v.tuple([text, value])), v.maxLength(32))),
  input: v.exactOptional(v.strictObject({ type: v.exactOptional(text), maxLength: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4096))),
    value: v.exactOptional(value), autocomplete: v.exactOptional(v.literal('off')), spellcheck: v.exactOptional(v.boolean()) })),
  when: v.exactOptional(conditionSchema()), repeat: v.exactOptional(v.strictObject({ source: path, as: path, index: v.exactOptional(path) })),
  action: v.exactOptional(action), children: v.exactOptional(v.pipe(v.array(template), v.maxLength(256))),
}));
const definition = v.strictObject({ frame: template, body: v.exactOptional(v.pipe(v.array(template), v.maxLength(256))),
  lifetime: v.picklist(['persistent', 'open']), showClass: v.exactOptional(text), closeRef: v.exactOptional(text),
  closeKeys: v.exactOptional(v.pipe(v.array(text), v.maxLength(32))),
  stopEvents: v.exactOptional(v.pipe(v.array(v.picklist(['pointerdown', 'touchstart', 'mousedown'])), v.maxLength(3))),
  keys: v.exactOptional(v.pipe(v.array(v.strictObject({ codes: v.pipe(v.array(text), v.maxLength(16)), action })), v.maxLength(16))),
  stopTyping: v.exactOptional(v.boolean()), focus: v.exactOptional(text),
  inputGuard: v.exactOptional(v.strictObject({ ref: text, milliseconds: v.pipe(v.number(), v.minValue(0), v.maxValue(1000)) })),
  layer: v.exactOptional(v.strictObject({ order: v.number() })),
  transient: v.exactOptional(v.strictObject({ milliseconds: v.pipe(v.number(), v.minValue(0), v.maxValue(60000)),
    flags: v.pipe(v.array(v.strictObject({ cls: text, when: conditionSchema() })), v.maxLength(16)) })),
});
/** Admitted content shared by renderer-free expansion and the page adapter. */
export type PanelDefinition = v.InferOutput<typeof definition>;
/** Refuse deep/unbounded programs before recursive schema admission. */
export function parsePanelDefinition(input: unknown): PanelDefinition {
  let nodes = 0;
  const visit = (entry: unknown, depth: number): void => {
    if (++nodes > 8192 || depth > 32) throw new RangeError('Panel template exceeds its bound');
    if (typeof entry === 'object' && entry !== null) for (const child of Object.values(entry)) visit(child, depth + 1);
  };
  visit(input, 0);
  const parsed = v.parse(definition, input);
  if (parsed.transient !== undefined && (parsed.lifetime !== 'persistent' || parsed.showClass === undefined)) throw new Error('Transient panel requires a persistent shown frame');
  return parsed;
}
