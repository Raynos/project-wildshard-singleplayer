// T1's formats (WORLDCLAW-SHARD T1, D87, row L1): the spec.json schema and design.md's machine block, on the first fixture,
// Thin Ice's dry-run pair converted (test/fixtures/worldclaw/thin-ice/).
// oxlint-disable-next-line import/no-nodejs-modules -- the test reads its committed fixtures
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- the test reads its committed fixtures
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { machineBlock, parseMachine, parseSpec } from '../scripts/worldclaw/spec';

const ROOT = resolve(import.meta.dirname, '..');
const FIX = join(ROOT, 'test/fixtures/worldclaw/thin-ice');

describe('T1 formats on Thin Ice', () => {
  const spec = parseSpec(JSON.parse(readFileSync(join(FIX, 'spec.json'), 'utf8')));
  const machine = parseMachine(machineBlock(readFileSync(join(FIX, 'design.md'), 'utf8')));

  it('the spec parses: 11 places, routes as legs, a gate on every edge', () => {
    expect(spec.slug).toBe('thin-ice');
    expect(spec.places).toHaveLength(11);
    expect(spec.routes.every((r) => r.legs.length > 0)).toBe(true);
    expect(spec.gates.map((g) => g.edge).sort()).toEqual(['E', 'N', 'S', 'W']);
  });
  it('the machine block parses and names the same places as the spec', () => {
    expect(machine.places.map((p) => p.id).sort()).toEqual(spec.places.map((p) => p.id).sort());
    expect(machine.quest).toHaveLength(12);
    expect(machine.boss?.place).toBe('spire');
  });
  it('a quest step between places says where in words', () => {
    const step4 = machine.quest.find((q) => q.n === 4);
    expect(step4?.place).toBeNull();
    expect(step4?.where).toContain('ferry line');
  });
  it('the template\'s machine block parses too', () => {
    const tpl = readFileSync(join(ROOT, 'scripts/worldclaw/design-template.md'), 'utf8');
    expect(() => parseMachine(machineBlock(tpl.replaceAll('<slug>', 'example').replaceAll('<id>', 'spawn').replaceAll('<name>', 'Spawn').replaceAll('<beat>', 'arrive')))).not.toThrow();
  });
  it('a design.md without a machine block is refused', () => {
    expect(() => machineBlock('# no block')).toThrow(/no ```json worldclaw block/);
  });
});
