import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const names = v.pipe(v.array(id), v.maxLength(128));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const marker = v.strictObject({ id, label: text, short: v.exactOptional(v.pipe(text, v.maxLength(18))), at: v.strictObject({ poi: v.literal('world'), x: finite, z: finite, y: v.exactOptional(finite) }), hideWhen: v.exactOptional(condition) });
const markers = v.pipe(v.array(marker), v.maxLength(32));
const done = v.pipe(condition, v.check((c) => [...(c.all ?? []), ...(c.any ?? []), ...(c.none ?? [])].length > 0, 'nonempty done condition'));
const step = v.strictObject({ id, objective: text, chip: v.exactOptional(v.pipe(text, v.maxLength(18))), hint: v.exactOptional(text), done, count: v.exactOptional(names), markers: v.exactOptional(markers) });
const quest = v.strictObject({ id, title: text, completeFlag: id, startWhen: v.exactOptional(condition), intro: v.exactOptional(v.strictObject({ objective: text, chip: v.exactOptional(v.pipe(text, v.maxLength(18))), hint: v.exactOptional(text), markers: v.exactOptional(markers) })), steps: v.pipe(v.array(step), v.minLength(1), v.maxLength(64)), onComplete: v.exactOptional(v.strictObject({ fact: v.exactOptional(id), scene: v.exactOptional(id), coins: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100))) })) });
const trigger = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('region'), flag: id, x: finite, z: finite, radius: v.pipe(finite, v.minValue(0.01), v.maxValue(500)), when: v.exactOptional(condition) }),
  v.strictObject({ id, kind: v.literal('death'), flag: id, tag: id, when: v.exactOptional(condition) }),
  v.strictObject({ id, kind: v.literal('script'), flag: id, condition: id, when: v.exactOptional(condition) }),
]);
const choice = v.strictObject({ id, label: text, next: v.nullable(id), when: v.exactOptional(condition), sets: v.exactOptional(names), scene: v.exactOptional(id) });
const node = v.strictObject({ id, lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(32)), sets: v.exactOptional(names), choices: v.pipe(v.array(choice), v.maxLength(16)) });
const dialogue = v.strictObject({ id, name: text, start: id, nodes: v.pipe(v.array(node), v.minLength(1), v.maxLength(128)) });
const raw = v.strictObject({ flags: names, quests: v.pipe(v.array(quest), v.maxLength(32)), triggers: v.pipe(v.array(trigger), v.maxLength(128)), dialogue: v.pipe(v.array(dialogue), v.maxLength(32)) });
/** Plain quest graphs, declared flags/triggers and finite dialogue trees; hooks name platform-resolved script ports. */
export type QuestData = v.InferOutput<typeof raw>;
const reads = (c: v.InferOutput<typeof condition> | undefined): string[] => [...(c?.all ?? []), ...(c?.any ?? []), ...(c?.none ?? [])];
/** Reject dangling flags, repeated identities, unreachable dialogue nodes and cycles before installing authored data. */
export function questDataRules(data: QuestData): string[] {
  const errors: string[] = [], flags = new Set(data.flags);
  const unique = (ids: readonly string[]): void => { if (new Set(ids).size !== ids.length) errors.push('unique declaration ids'); };
  const checkFlags = (ids: readonly string[]): void => { for (const flag of ids) if (!flags.has(flag)) errors.push(`undeclared quest flag ${flag}`); };
  unique(data.flags); unique(data.quests.map((q) => q.id)); unique(data.triggers.map((t) => t.id)); unique(data.dialogue.map((d) => d.id));
  for (const q of data.quests) {
    unique(q.steps.map((s) => s.id)); checkFlags([q.completeFlag, ...reads(q.startWhen)]);
    for (const s of q.steps) checkFlags([...reads(s.done), ...(s.count ?? []), ...(s.markers ?? []).flatMap((m) => reads(m.hideWhen))]);
    for (const m of q.intro?.markers ?? []) checkFlags(reads(m.hideWhen));
  }
  for (const t of data.triggers) checkFlags([t.flag, ...reads(t.when)]);
  for (const d of data.dialogue) {
    unique(d.nodes.map((n) => n.id)); const nodes = new Map(d.nodes.map((n) => [n.id, n])), visited = new Set<string>(), active = new Set<string>();
    const visit = (name: string): void => {
      const n = nodes.get(name); if (n === undefined) { errors.push(`unknown dialogue node ${name}`); return; }
      if (active.has(name)) { errors.push('acyclic dialogue tree'); return; } if (visited.has(name)) return;
      visited.add(name); active.add(name); unique(n.choices.map((c) => c.id)); checkFlags(n.sets ?? []);
      for (const c of n.choices) { checkFlags([...(c.sets ?? []), ...reads(c.when)]); if (c.next !== null) visit(c.next); }
      active.delete(name);
    };
    visit(d.start); if (visited.size !== d.nodes.length) errors.push('reachable dialogue nodes');
  }
  return [...new Set(errors)];
}
/** Serialisable quest/dialogue section with semantic validation in the same admission pass. */
export const QuestDataSchema = v.pipe(raw, v.check((data) => questDataRules(data).length === 0, 'valid quest and dialogue graph'));
/** Compile TypeScript-authored rows to validated serialisable quest/dialogue data. */
export function parseQuestData(input: unknown): QuestData { return v.parse(QuestDataSchema, input); }
