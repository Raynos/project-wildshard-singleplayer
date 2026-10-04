import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { Bindings } from '../../src/engine/input/bindings';
import { BindingTable, foldKeys, keyOfCode, bindableKey } from '../../src/engine/input/bindingTable';
import { keycap } from '../../src/engine/input/ControlsPanel';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { KEY_BINDINGS } from '../../src/game/keyBindings';
import { RIDE_KEY_ROWS } from '../../src/shards/nalati-grasslands/ride/input';

let scope: Scope;
/** the game's contexts, plus Nalati's riding ones when `riding` (they register only on that shard) */
function setup(riding = false, keep = false): { bindings: Bindings; table: BindingTable } {
  const bindings = new Bindings(() => undefined); if (!keep) bindings.reset();
  for (const context of INPUT_CONTEXTS) bindings.define(context.id, context.keys ?? {});
  bindings.describe(KEY_BINDINGS, scope);
  if (riding) {
    bindings.define('ride.foot', { 'ride.whistle': ['KeyX'], 'ride.offer': ['KeyG'] });
    bindings.define('ride', { 'move.forward': ['KeyW'], 'move.back': ['KeyS'], 'move.left': ['KeyA'], 'move.right': ['KeyD'], 'ride.gallop': ['ShiftLeft', 'ShiftRight'] });
    bindings.describe({ rows: RIDE_KEY_ROWS }, scope);
  }
  return { bindings, table: new BindingTable(bindings) };
}
const rowOf = (table: BindingTable, id: string) => { const row = table.rows().find((r) => r.def.id === id); if (row === undefined) throw new Error(`no row ${id}`); return row; };
const keysOf = (table: BindingTable, id: string): (string | undefined)[] => { const row = rowOf(table, id); return row.cells.map((_, i) => table.key(row, i)); };
beforeEach(() => { scope = new Scope('binding-table'); });
afterEach(() => { new Bindings(() => undefined).reset(); scope.dispose(); });

describe('J10 default keys (Jake: layout A with the proposed defaults)', () => {
  it('dodge is V with Alt as the alt, the bag I with Tab, and the arrows are the movement alt', () => {
    const { table } = setup();
    expect(keysOf(table, 'dodge')).toEqual(['KeyV', 'AltLeft']);
    expect(keysOf(table, 'bag')).toEqual(['KeyI', 'Tab']);
    expect(keysOf(table, 'forward')).toEqual(['KeyW', 'ArrowUp']);
    expect(keysOf(table, 'back')).toEqual(['KeyS', 'ArrowDown']);
    expect(keysOf(table, 'left')).toEqual(['KeyA', 'ArrowLeft']);
    expect(keysOf(table, 'right')).toEqual(['KeyD', 'ArrowRight']);
  });
  it('binds no Control key anywhere on foot (Ctrl+W closes the tab; modified keydowns never reach play)', () => {
    const onFoot = INPUT_CONTEXTS.find((context) => context.id === 'onFoot');
    expect(Object.values(onFoot?.keys ?? {}).flat().filter((code) => code?.startsWith('Control'))).toEqual([]);
    expect(bindableKey('ControlLeft')).toBe(false); expect(bindableKey('MetaRight')).toBe(false); expect(bindableKey('KeyC')).toBe(true);
  });
  it('lists the weapon slots as one "Weapon 1–4" row of four keys; 5–9 stay bound', () => {
    const { bindings, table } = setup();
    const slots = rowOf(table, 'slots');
    expect(slots.def.label).toBe('Weapon 1–4'); expect(slots.cells.map((_, i) => table.key(slots, i))).toEqual(['Digit1', 'Digit2', 'Digit3', 'Digit4']);
    expect(table.rows().filter((row) => row.def.actions.some((action) => action.startsWith('swap.slot.')))).toHaveLength(1);
    for (const slot of [5, 6, 7, 8, 9] as const) expect(bindings.keys('onFoot')[`swap.slot.${slot}`]).toEqual([`Digit${slot}`]);
  });
  it('names actions plainly, in On foot · Swimming | Combat · Menus, with riding only where it registers', () => {
    const { table } = setup();
    for (const row of table.rows()) expect(row.def.label).not.toMatch(/·|^[a-z]+\.[a-z]/u);
    expect(table.groups().map((group) => [group.def.label, group.def.column])).toEqual([['On foot', 0], ['Swimming', 0], ['Combat', 1], ['Menus', 1]]);
    expect(rowOf(table, 'forward').def.label).toBe('Move forward');
    const riding = setup(true).table;
    expect(riding.groups().map((group) => group.def.label)).toEqual(['On foot', 'Swimming', 'Combat', 'Riding', 'Menus']);
    expect(keysOf(riding, 'whistle')[0]).toBe('KeyX'); expect(keysOf(riding, 'gallop')[0]).toBe('Shift');
  });
  it('has no clash between any two listed default keys', () => {
    for (const riding of [false, true]) {
      const { table } = setup(riding);
      for (const row of table.rows()) row.cells.forEach((_, cell) => {
        const key = table.key(row, cell);
        if (key !== undefined) expect(table.conflict(row, cell, key), `${row.def.id}/${cell} ${key}`).toBeUndefined();
      });
    }
  });
});

describe('the binding table', () => {
  it('reports a clash with its holder and changes nothing until SWAP KEYS', () => {
    const { bindings, table } = setup();
    const use = rowOf(table, 'use');
    expect(table.assign(use, 0, 'KeyF')).toMatchObject({ label: 'Attack', cell: 1 });
    expect(keysOf(table, 'use')[0]).toBe('KeyE'); expect(keysOf(table, 'attack')).toEqual(['Mouse0', 'KeyF']);
    expect(table.assign(use, 0, 'KeyF', true)).toBeUndefined();
    expect(keysOf(table, 'use')[0]).toBe('KeyF'); expect(keysOf(table, 'attack')).toEqual(['Mouse0', 'KeyE']);
    // a row writes every context that shares its default key: the menu's and the dialog's Interact, every weapon's Attack
    expect(bindings.keys('menu').use).toEqual(['KeyF']); expect(bindings.keys('dialog').use).toEqual(['KeyF']);
    expect(bindings.keys('weapon.ranged').attack).toEqual(['Mouse0', 'KeyE']);
  });
  it('swaps KEY and ALT inside one row, binds a mouse button and clears an alt', () => {
    const { table } = setup();
    const forward = rowOf(table, 'forward');
    expect(table.assign(forward, 0, 'ArrowUp', true)).toBeUndefined(); expect(keysOf(table, 'forward')).toEqual(['ArrowUp', 'KeyW']);
    const lock = rowOf(table, 'lock');
    expect(table.assign(lock, 1, 'Mouse4')).toBeUndefined(); expect(keysOf(table, 'lock')).toEqual(['Mouse1', 'Mouse4']);
    expect(table.assign(rowOf(table, 'dodge'), 1, undefined)).toBeUndefined(); expect(keysOf(table, 'dodge')).toEqual(['KeyV', undefined]);
  });
  it('catches a binding the table does not list (Note on N) and swaps it too', () => {
    const { bindings, table } = setup();
    expect(table.assign(rowOf(table, 'hover'), 0, 'KeyN')).toMatchObject({ label: 'Note', hidden: { context: 'onFoot', action: 'note' } });
    expect(table.assign(rowOf(table, 'hover'), 0, 'KeyN', true)).toBeUndefined();
    expect(bindings.keys('onFoot').note).toEqual(['KeyH']); expect(bindings.keys('onFoot').hover).toEqual(['KeyN']);
  });
  it('treats either Shift as one key and keeps a swap across the save', () => {
    expect(foldKeys(['ShiftLeft', 'ShiftRight'])).toEqual(['Shift']); expect(keyOfCode('ShiftRight')).toBe('Shift');
    const { table } = setup();
    expect(table.assign(rowOf(table, 'dodge'), 0, 'Shift')).toMatchObject({ label: 'Sprint' });
    table.assign(rowOf(table, 'jump'), 0, 'KeyB');
    const reloaded = setup(false, true).table; expect(keysOf(reloaded, 'jump')[0]).toBe('KeyB');
  });
  it('migrates by changing defaults only: a saved custom key survives, untouched actions take the new defaults', () => {
    const old = setup().bindings; old.assign('onFoot', 'dodge', ['KeyB']); // an old save's rebinding
    const { table } = setup(false, true);
    expect(keysOf(table, 'dodge')).toEqual(['KeyB', undefined]);
    expect(keysOf(table, 'bag')).toEqual(['KeyI', 'Tab']);
    table.reset(); expect(keysOf(table, 'dodge')).toEqual(['KeyV', 'AltLeft']);
  });
  it('shows keycaps, not codes', () => {
    expect(['KeyW', 'Digit3', 'Mouse0', 'Mouse2', 'ArrowUp', 'Shift', 'AltLeft', 'Space', 'Escape'].map(keycap)).toEqual(['W', '3', 'LMB', 'RMB', '↑', 'Shift', 'Alt', 'Space', 'Esc']);
  });
});
