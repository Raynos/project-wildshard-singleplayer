import type * as v from 'valibot';
import type { SECTIONS } from './sections';

type QuestRows = v.InferOutput<(typeof SECTIONS)['custom/questRows']>;
type EffectRow = QuestRows['effects'][number];
type EffectId = `effect.${string}`;
type Tag = `${string}.${string}`;
/** a perk row typed for the effect registry */
export interface PerkRow extends Omit<EffectRow, 'id' | 'tags' | 'grants' | 'removes'> { id: EffectId; tags: Tag[]; grants?: Tag[]; removes?: EffectId[] }

const effectId = (id: string): EffectId => {
  if (!id.startsWith('effect.')) throw new Error(`Driftwood effect id is not an effect: ${id}`);
  return `effect.${id.slice('effect.'.length)}`;
};
const tag = (value: string): Tag => {
  const dot = value.indexOf('.');
  if (dot === -1) throw new Error(`Driftwood tag has no namespace: ${value}`);
  return `${value.slice(0, dot)}.${value.slice(dot + 1)}`;
};

/** The product's perk rows as the effect registry types them (ids `effect.*`, namespaced tags), refusing any other. */
export function driftwoodEffects(rows: readonly EffectRow[]): PerkRow[] {
  return rows.map(row => {
    const { id, tags, grants, removes, ...rest } = row;
    return { ...rest, id: effectId(id), tags: tags.map(tag),
      ...(grants === undefined ? {} : { grants: grants.map(tag) }), ...(removes === undefined ? {} : { removes: removes.map(effectId) }) };
  });
}
