// src/ui/debugOptions.ts — the Debug menu's registry (E162): every debug-only option has exactly one row, in a group that
// exists, with choices that are the option's own values.
import { describe, expect, it } from 'vitest';
import { DEBUG_GROUPS, DEBUG_ROWS } from '../src/ui/debugOptions';
import { OPTION_VALUES, BOOT_OPTIONS, settingParams, type OptionKey } from '../src/ui/Settings';

describe('Debug registry', () => {
  it('row ids are unique and every row sits in a declared group', () => {
    const ids = DEBUG_ROWS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(DEBUG_GROUPS.map((g) => g.id));
    for (const r of DEBUG_ROWS) expect(groups.has(r.group), `${r.id} → ${r.group}`).toBe(true);
    for (const g of DEBUG_GROUPS) expect(DEBUG_ROWS.some((r) => r.group === g.id), `group ${g.id} has no row`).toBe(true);
  });

  it('every debug-only option (no URL param, not a boot option) has a row, and its choices are the option\'s values', () => {
    const rows = new Map(DEBUG_ROWS.map((r) => [r.id, r]));
    for (const k of Object.keys(OPTION_VALUES) as OptionKey[]) {
      if (settingParams(k).length > 0 || BOOT_OPTIONS.includes(k)) continue;
      const row = rows.get(k);
      expect(row, `option ${k} has no Debug row`).toBeDefined();
      if (row) expect(new Set(row.choices().map((c) => c.v))).toEqual(new Set<string>(OPTION_VALUES[k]));
    }
  });

  it('every row has a label and a one-line note', () => {
    for (const r of DEBUG_ROWS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.note.length, r.id).toBeGreaterThan(0);
      expect(r.note.includes('\n')).toBe(false);
    }
  });
});
