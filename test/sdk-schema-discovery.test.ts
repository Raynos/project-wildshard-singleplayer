import { expect, it, vi } from 'vitest';
import { ShardfileSchema } from '../src/sdk/shardfile';
import { formatJsonSchemas, schemaAt, schemaDeclaration } from '../src/sdk/formatJsonSchema';
import { runCli } from '../src/sdk/cli';

it('discovers the full root, exact identifier rules, coordinate spellings and hearing arity', () => {
  const root = schemaDeclaration(ShardfileSchema);
  expect(root.kind).toBe('strict_object');
  expect(Object.keys(root.properties ?? {})).toContain('look');
  expect(Object.keys(root.properties ?? {})).toContain('props');
  expect(Object.keys(schemaAt(root, '/properties/spawn/wrapped/properties') as object)).toEqual(['x', 'y', 'z', 'yaw']);
  expect(schemaAt(root, '/properties/creatures/wrapped/properties/spawns/item/properties/id/rules/0/requirement')).toBe('^[a-z][a-z0-9.:-]*$');
  const group = schemaAt(root, '/properties/creatures/wrapped/properties/groups/wrapped/item/alternatives/1/properties/hearing/items');
  expect(group).toHaveLength(4);
  expect(schemaAt(root, '/properties/creatures/wrapped/properties/spawns/item/properties/at/items')).toHaveLength(3);
  expect(root.rules.some(rule => rule.kind === 'raw_check')).toBe(true);
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- This verifies the CLI's JSON wire format, not an in-memory clone.
  expect(JSON.parse(JSON.stringify(root))).toEqual(root);
});

it('prints public roots and exact selected fields, refusing missing roots, paths and malformed pointers', async () => {
  const print = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    await runCli(['schema', 'list']);
    expect(JSON.parse(String(print.mock.calls.at(-1)?.[0]))).toEqual(['shardfile', ...Object.keys(formatJsonSchemas())]);
    await runCli(['schema', 'shardSections.Spawn', '/properties/x']);
    expect(JSON.parse(String(print.mock.calls.at(-1)?.[0]))).toEqual(formatJsonSchemas()['shardSections.Spawn']?.properties?.['x']);
    await runCli(['schema', 'shardfile', '/ui']);
    expect(JSON.parse(String(print.mock.calls.at(-1)?.[0]))).toEqual(schemaAt(schemaDeclaration(ShardfileSchema), '/properties/ui'));
    await runCli(['schema', 'ui.Ui']);
    expect(JSON.parse(String(print.mock.calls.at(-1)?.[0]))).toEqual(formatJsonSchemas()['ui.Ui']);
    await expect(runCli(['schema', 'missing'])).rejects.toThrow('Unknown schema root');
    await expect(runCli(['schema', 'shardfile', '/properties/missing'])).rejects.toThrow('Unknown schema pointer');
    await expect(runCli(['schema', 'shardfile', '/missing'])).rejects.toThrow('Unknown schema pointer');
    expect(() => schemaAt({}, '/~2')).toThrow('Invalid schema pointer');
    expect(() => schemaAt({}, 'properties')).toThrow('start with /');
    expect(() => schemaAt({}, '/toString')).toThrow('Unknown schema pointer');
    expect(schemaAt({ 'a/b': { '~': 1 } }, '/a~1b/~0')).toBe(1);
  } finally { print.mockRestore(); }
});
