import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { InputService, type ActionCommand } from '../../src/engine/input/InputService';
import type { DebugRowSpec } from '../../src/engine/level/context';
import { LevelRegistrations } from '../../src/engine/level/registrations';
import { installDeclaredPlumbing } from '../../src/game/shard/declaredPlumbing';
import { parsePlumbing } from '../../src/game/shardfile/plumbing';
import { TEMPLATE_PLUMBING } from '../../src/shards/_template/data/plumbing';

const plumbingFixture = parsePlumbing({ ...TEMPLATE_PLUMBING, debug: [{
  id: 'template.oil', group: 'tools', label: 'Template lantern oil', choices: [{ value: 'keep', text: 'Keep' }, { value: 'refill', text: 'Refill', scene: 'template.lantern.refill' }],
  initial: 'keep', note: 'Independent declared Debug adapter fixture.', ask: 'E357', reviewBy: '2026-12-01',
}] });
it('the shipped template retires its teaching oil Debug row while preserving the normal lantern control', () => {
  expect(TEMPLATE_PLUMBING.debug).toEqual([]);
  expect(TEMPLATE_PLUMBING.input[0]?.actions[0]?.id).toBe('template.lantern.toggle');
});

function fixture(input = new InputService(() => 0), instance = 'template-1', tier: 'phone' | 'desktop' = 'phone') {
  const scope = new Scope(instance), registrations = new LevelRegistrations(), debug = new Map<string, DebugRowSpec>(), scenes: string[] = [];
  let active = true;
  const handles = installDeclaredPlumbing(plumbingFixture, { input, instance, tier, scope, active: () => active,
    scene: (id) => { scenes.push(id); }, knobs: (schema) => { registrations.knobs(schema, scope); },
    debugRow: (row) => { debug.set(row.id, row); scope.onDispose(() => { debug.delete(row.id); }); },
  });
  return { input, scope, registrations, debug, scenes, handles, pause: () => { active = false; } };
}
it('routes authored keyboard commands and replay through the same scoped action path', () => {
  const first = fixture(), commands: ActionCommand[] = [];
  first.input.recordCommand = (command) => { commands.push(command); };
  first.input.executeCommand({ kind: 'physical', code: 'KeyL', on: true, at: 0 });
  first.input.executeCommand({ kind: 'physical', code: 'KeyL', on: false, at: 1 });
  expect(first.scenes).toEqual(['template.lantern.toggle']);
  expect(first.handles.knobs).toEqual({ 'template.propCount': 10 });
  expect(first.input.touchLayout().verbs['verb.1']).toMatchObject({ action: 'template.lantern.toggle', label: 'LANTERN' });
  const replay = fixture(); for (const command of commands) replay.input.executeCommand(command);
  expect(replay.scenes).toEqual(first.scenes);
  first.pause(); first.input.executeCommand({ kind: 'physical', code: 'KeyL', on: true, at: 2 });
  expect(first.scenes).toHaveLength(1); expect(first.input.contexts).toEqual([]);
  first.scope.dispose(); replay.scope.dispose();
});
it('admits Debug choices as named scenes and unregisters settings on disposal', () => {
  const f = fixture(), row = f.debug.get('template.oil');
  expect(row).toMatchObject({ label: 'Template lantern oil', initial: 'keep', ask: 'E357' });
  row?.change('keep'); expect(f.scenes).toEqual([]);
  row?.change('refill'); expect(f.scenes).toEqual(['template.lantern.refill']);
  expect(() => row?.change('unknown')).toThrow('Unknown declared Debug choice');
  expect(f.registrations.knobSchemas()).toHaveLength(1);
  f.scope.dispose(); expect(f.debug.size).toBe(0); expect(f.registrations.knobSchemas()).toEqual([]);
  f.input.press('template.lantern.toggle'); expect(f.scenes).toHaveLength(1); expect(f.input.contexts).toEqual([]);
});
it('qualifies two instance contexts and selects tier knobs without crossing active ownership', () => {
  const input = new InputService(() => 0), one = fixture(input), two = fixture(input, 'template-2', 'desktop');
  one.pause(); input.press('template.lantern.toggle');
  expect(one.scenes).toEqual([]); expect(two.scenes).toEqual(['template.lantern.toggle']);
  expect(one.handles.contexts.get('template.lantern')).toBe('template-1.template.lantern');
  expect(two.handles.contexts.get('template.lantern')).toBe('template-2.template.lantern');
  expect(two.handles.knobs['template.propCount']).toBe(20);
  two.scope.dispose(); input.press('template.lantern.toggle'); expect(two.scenes).toHaveLength(1); one.scope.dispose();
});
it('rejects invalid namespaces, dangling choices and unbounded data before installation', () => {
  const base = structuredClone(plumbingFixture), context = base.input[0], debug = base.debug[0];
  expect(context).toBeDefined(); expect(debug).toBeDefined();
  if (context === undefined || debug === undefined) throw new Error('fixture declarations missing');
  for (const invalid of [
    { ...base, input: [{ ...context, id: 'foreign.lantern' }] },
    { ...base, input: [{ ...context, touch: { slot: 'verb.1', action: 'template.missing', label: 'Missing', icon: '' } }] },
    { ...base, input: [context, context] },
    { ...base, debug: [{ ...debug, initial: 'missing' }] },
    { ...base, knobs: [{ id: 'template.propCount', phone: Number.NaN, desktop: 20 }] },
  ]) expect(() => parsePlumbing(invalid)).toThrow();
});
