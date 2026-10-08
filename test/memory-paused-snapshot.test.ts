import { expect, it } from 'vitest';
import { ownedWebContentPid, processMemory } from '../scripts/memory/pausedSnapshot.mjs';

it('selects a unique owned WebContent process and refuses unrelated or ambiguous tabs', () => {
  const table = '1 0 launchd\n10 1 node\n11 10 driver\n12 11 MiniBrowser\n13 12 WebContent\n99 1 WebContent';
  expect(ownedWebContentPid(table, 10)).toBe(13);
  expect(ownedWebContentPid(table, 77)).toBeNull();
  expect(ownedWebContentPid(`${table}\n14 12 WebProcess`, 10)).toBeNull();
});
it('keeps unavailable native maps explicit without substituting heap capacity or another PID', () => {
  const commands: string[] = [];
  expect(processMemory(null, () => { throw new Error('Must not execute'); }).unavailable).toContain('No unique');
  const result = processMemory(13, (command, args) => {
    commands.push(`${command} ${args.join(' ')}`);
    if (command === 'footprint') throw new Error('permission denied');
    return 'Physical footprint: 600M';
  });
  expect(commands).toEqual(['vmmap -summary 13', 'footprint -f bytes -p 13']);
  expect(result.files).toEqual([{name:'vmmap-summary',text:'Physical footprint: 600M'}, {name:'footprint',error:'Error: permission denied'}]);
});
