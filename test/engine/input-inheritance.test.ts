// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { InputService } from '../../src/engine/input/InputService';
import { Bindings } from '../../src/engine/input/bindings';
import { BindingTable } from '../../src/engine/input/bindingTable';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { KEY_BINDINGS } from '../../src/game/keyBindings';

describe('custom context key inheritance', () => {
  it('routes parent rebinds to declared child actions and keeps explicit keys/unbinds local', () => {
    const input = new InputService(() => 0), scope = new Scope('keysFrom'); input.bindings.reset();
    try {
      input.register({ id: 'parent', actions: ['attack', 'heavy', 'reload'], keys: { attack: ['KeyF'], heavy: ['Mouse2'], reload: ['KeyR'] } }, scope);
      input.register({ id: 'child', actions: ['attack', 'heavy'], keysFrom: 'parent' }, scope);
      input.register({ id: 'custom', actions: ['attack', 'heavy'], keysFrom: 'parent', keys: { attack: ['KeyT'], heavy: [] } }, scope);
      input.push('child', scope); input.install(scope);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' })); expect(input.consume('attack')).toBe(true);
      input.bindings.assign('parent', 'attack', ['KeyY']); expect(input.held('attack')).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY' })); expect(input.consume('attack')).toBe(true);
      expect(input.bindings.keys('child')).toEqual({ attack: ['KeyY'], heavy: ['Mouse2'] });
      expect(input.bindings.keys('custom')).toEqual({ attack: ['KeyT'], heavy: [] });
      input.bindings.assign('child', 'heavy', ['KeyH']); expect(input.bindings.keys('parent').heavy).toEqual(['KeyH']);
      expect(input.bindings.defaultKeys('child')).toEqual({ attack: ['KeyF'], heavy: ['Mouse2'] });
      expect(() => input.register({ id: 'unknown', actions: ['attack'], keysFrom: 'missing' }, scope)).toThrow('Unknown key source');
      expect(input.has('unknown')).toBe(false);
    } finally { scope.dispose(); input.bindings.reset(); }
  });

  it('shares one desktop table row/write target and cannot pin a stale inherited saved choice', () => {
    const bindings = new Bindings(() => undefined), scope = new Scope('keysFrom-table'); bindings.reset();
    try {
      for (const def of INPUT_CONTEXTS) bindings.define(def.id, def.keys ?? {});
      // Prior shards copied keys; existing overrides on those copies must not defeat inheritance.
      bindings.define('custom.melee', { attack: ['Mouse0', 'KeyF'], heavy: ['Mouse2'] });
      bindings.assign('custom.melee', 'attack', ['KeyZ']);
      bindings.define('custom.melee', {}, { context: 'weapon.melee', actions: ['attack', 'heavy', 'lock'] });
      bindings.define('second.melee', {}, { context: 'custom.melee', actions: ['attack', 'heavy'] });
      bindings.describe(KEY_BINDINGS, scope); const table = new BindingTable(bindings);
      const attack = table.rows().filter((row) => row.def.id === 'attack');
      const heavy = table.rows().filter((row) => row.def.id === 'heavy');
      expect(attack).toHaveLength(1); expect(heavy).toHaveLength(1);
      const row = attack[0]; if (row === undefined) throw new Error('Attack row missing');
      expect(row.cells.flatMap((cell) => cell.targets).some((target) => target.context === 'custom.melee' || target.context === 'second.melee')).toBe(false);
      expect(bindings.keys('custom.melee').attack).toEqual(['Mouse0', 'KeyF']);
      expect(table.assign(row, 1, 'KeyT')).toBeUndefined();
      expect(bindings.keys('weapon.melee').attack).toEqual(['Mouse0', 'KeyT']);
      expect(bindings.keys('custom.melee').attack).toEqual(['Mouse0', 'KeyT']);
      expect(bindings.keys('second.melee').attack).toEqual(['Mouse0', 'KeyT']);
      bindings.assign('weapon.melee', 'attack', ['KeyY']); expect(bindings.keys('custom.melee').attack).toEqual(['KeyY']);
      expect(() => bindings.define('weapon.melee', {}, { context: 'second.melee', actions: ['attack'] })).toThrow('Cyclic');
    } finally { scope.dispose(); bindings.reset(); }
  });

  it('detects and swaps a child-only key conflict when a table row writes the parent', () => {
    const bindings = new Bindings(() => undefined), scope = new Scope('keysFrom-conflict'); bindings.reset();
    try {
      for (const def of INPUT_CONTEXTS) bindings.define(def.id, def.keys ?? {});
      bindings.define('custom.melee', { 'reload': ['KeyG'] }, { context: 'weapon.melee', actions: ['attack', 'heavy', 'reload'] });
      bindings.describe(KEY_BINDINGS, scope); const table = new BindingTable(bindings);
      const row = table.rows().find((entry) => entry.def.id === 'attack');
      if (row === undefined) throw new Error('Attack row missing');
      expect(table.assign(row, 1, 'KeyG')).toMatchObject({ label: 'Reload', hidden: { context: 'custom.melee', action: 'reload' } });
      expect(bindings.keys('custom.melee')['reload']).toEqual(['KeyG']);
      expect(table.assign(row, 1, 'KeyG', true)).toBeUndefined();
      expect(bindings.keys('weapon.melee').attack).toEqual(['Mouse0', 'KeyG']);
      expect(bindings.keys('custom.melee').attack).toEqual(['Mouse0', 'KeyG']);
      expect(bindings.keys('custom.melee')['reload']).toEqual(['KeyF']);
    } finally { scope.dispose(); bindings.reset(); }
  });
});
