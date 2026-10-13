import { SAND_FIELDS } from '../data/sandFields';

/** Bind the immutable sand row to named runtime maps, preserving fresh nested row values. */
export function sandEntry(maps: { readonly grain: string; readonly trail: string; readonly shadow: string }): unknown {
  const fields = structuredClone(SAND_FIELDS);
  return { ...fields, ground: { ...fields.ground,
    grain: { map: maps.grain, ...fields.ground.grain },
    trail: { map: maps.trail, ...fields.ground.trail },
    keyShadow: { map: maps.shadow, ...fields.ground.keyShadow } } };
}
