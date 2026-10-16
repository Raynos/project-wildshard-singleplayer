import { expect, test } from 'vitest';
import { GROUND_FILES } from '../src/shards/driftwood-isle/data/groundFiles';
import { PALM_FILES } from '../src/shards/driftwood-isle/data/palmFiles';
import { HIBISCUS_FILES } from '../src/shards/driftwood-isle/data/hibiscusFiles';
import { REEF_FILES } from '../src/shards/driftwood-isle/data/reefFiles';
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_OUTPUT } from '../src/shards/driftwood-isle/data/output';

test('all draw labels preserve the authored tier, variant and deduplicated blob identity', () => {
  const names = new Set(DRIFTWOOD_OUTPUT.blobs.map(row => row.name));
  const seen = new Set<string>();
  const check = (label: string, value: unknown): void => {
    if (typeof value === 'string') {
      const name = DRIFTWOOD_ASSET_NAMES[label];
      if (name === undefined) throw new Error(`Missing admitted draw: ${label}`);
      expect(name).toBe(DRIFTWOOD_ASSET_NAMES[value]);
      expect(names.has(name)).toBe(true); seen.add(label);
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) check(`${label}:${key}`, child);
    } else throw new Error('Invalid authored source tree');
  };
  for (const [family, files] of Object.entries({ ground: GROUND_FILES, palms: PALM_FILES, hibiscus: HIBISCUS_FILES, reef: REEF_FILES })) check(`draw:${family}`, files);
  expect(seen.size).toBe(33);
  expect(new Set(Object.keys(DRIFTWOOD_ASSET_NAMES).filter(key => key.startsWith('draw:')))).toEqual(seen);
  expect(DRIFTWOOD_ASSET_NAMES['draw:reef:coral:brain']).toBe(DRIFTWOOD_ASSET_NAMES['draw:reef:coral:default']);
  expect(DRIFTWOOD_ASSET_NAMES['draw:reef:weed:tint-0']).toBe(DRIFTWOOD_ASSET_NAMES['draw:reef:weed:default']);
});
