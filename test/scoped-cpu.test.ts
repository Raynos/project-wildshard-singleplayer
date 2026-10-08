import { expect, it } from 'vitest';
import { ScopedCpuMeter } from '../src/engine/core/scopedCpu';
import { Scope } from '../src/engine/app/scope';

it('charges fixed repetitions and update to one completed owner frame, excluding shell work', () => {
  const shell = new Scope('shell'), level = shell.child('level'), cpu = new ScopedCpuMeter();
  cpu.bind(level, 'content'); const owned = cpu.ticket(level.child('body'));
  expect(cpu.ticket(shell)).toBeNull();
  cpu.begin(); cpu.record(owned, 9); cpu.end(); expect(cpu.snapshot().frame).toBe(0);
  cpu.enabled = true; cpu.begin(); cpu.record(owned, 1); cpu.record(owned, 2); cpu.record(null, 20);
  expect(cpu.snapshot().owners[0]?.ms).toBe(0);
  cpu.end(); expect(cpu.snapshot()).toMatchObject({ frame: 1, owners: [{ id: 'content', ms: 3, calls: 2 }] });
  cpu.begin(); cpu.end(); expect(cpu.snapshot().owners[0]).toEqual({ id: 'content', ms: 0, calls: 0 });
  shell.dispose();
});

it('assigns nested residents exactly once, rejects fabricated tickets and retires disposed owners', () => {
  const root = new Scope('root'), resident = root.child('resident'), cpu = new ScopedCpuMeter();
  cpu.bind(root, 'page'); cpu.bind(resident, 'instance'); cpu.enabled = true;
  const ticket = cpu.ticket(resident.child('entered')); expect(ticket?.id).toBe('instance');
  cpu.begin(); cpu.record(ticket, 2); cpu.record({ id: 'page', ms: 0, calls: 0 }, 100); cpu.end();
  expect(cpu.snapshot().owners).toEqual([{ id: 'page', ms: 0, calls: 0 }, { id: 'instance', ms: 2, calls: 1 }]);
  expect(() => cpu.record(ticket, Number.NaN)).toThrow('Invalid CPU');
  resident.dispose(); cpu.begin(); cpu.record(ticket, 100); cpu.end();
  expect(cpu.snapshot().owners).toEqual([{ id: 'page', ms: 0, calls: 0 }]);
  expect(() => cpu.bind(root, 'again')).toThrow('unique live scope'); root.dispose();
});
