// oxlint-disable-next-line import/no-nodejs-modules -- Reproduce only the original offline inventory facts for this pure factory's input.
import { readdirSync, statSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the same confined authored public roots as the predecessor writer.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineBootProgram, nineBootDiscovery } from '../src/shards/nine-dragon-stack/generators/bootDiscovery';
import { bootDiscovery } from './fixtures/nine-boot-discovery';
import original from './fixtures/nine-boot-discovery.json' with { type: 'json' };

function inventory(): Record<string, number | true> {
  const root = resolve('public'), bytes: Record<string, number | true> = {};
  for (const folder of ['assets/nine-dragon', 'assets/baked/nine-dragon-stack']) {
    for (const file of readdirSync(resolve(root, folder), { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue;
      const path = resolve(file.parentPath, file.name); bytes[`/${path.slice(root.length + 1)}`] = statSync(path).size;
    }
  }
  return Object.fromEntries(Object.keys(bytes).filter(path => !path.endsWith('.DS_Store')).sort().map(path => [path, bytes[path] ?? true]));
}

test('all four source discovery values preserve their complete original canonical values', () => {
  const rows = nineBootDiscovery(inventory());
  expect(Object.keys(rows).sort()).toEqual(original.map(row => row.slot).sort());
  for (const row of original) {
    const value: unknown = Reflect.get(rows, row.slot);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value))), row.slot).toBe(row.hash);
  }
  expect(rows['boot.files']).toHaveLength(30);
  for (const modes of Object.values(rows['boot.sources'].modes)) for (const files of Object.values(modes)) expect(files.props).toHaveLength(30);
});

test('inventory presence controls the same phone fallback and authored-file filtering', () => {
  const before = inventory(), cold = nineBootDiscovery(before), changed = { ...before };
  const phone = '/assets/nine-dragon/paint/concrete.phone.webp', desktop = '/assets/nine-dragon/paint/concrete.jpg';
  expect(cold['boot.sources'].modes.phone.img.props).toContain(phone);
  delete changed[phone];
  const fallback = nineBootDiscovery(changed);
  expect(fallback['boot.sources'].modes.phone.img.props).not.toContain(phone);
  expect(fallback['boot.sources'].modes.phone.img.props).toContain(desktop);
  delete changed[desktop];
  const absent = nineBootDiscovery(changed);
  expect(absent['boot.sources'].modes.phone.img.props).toHaveLength(29);
  expect(absent['boot.sources'].modes.desktop.img.props).toHaveLength(29);
  expect(absent['boot.explore']).toEqual(cold['boot.explore']);
  expect(absent.poses).toEqual(cold.poses);
});

test('the injected source reader retains every original value and refuses older contexts', () => {
  for (const row of original) {
    const value: unknown = Reflect.get(bootDiscovery, row.slot);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(value))), row.slot).toBe(row.hash);
  }
  expect(() => nineBootProgram({})).toThrow('requires current inputFiles capability');
});


test('the retired boot job has no source handoffs or registered writer', () => {
  const prefix = 'src/shards/nine-dragon-stack/boot/';
  for (const name of ['metadata.generated.json', 'declaration.generated.ts', 'lookTypes.generated.d.ts', 'files.generated.json', 'sources.generated.json', 'explore.generated.json', 'poses.generated.json']) {
    expect(existsSync(`${prefix}${name}`), name).toBe(false);
  }
});
