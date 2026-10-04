import { expect, it } from 'vitest';
import { isMirroredSave } from '../../src/engine/native/saves';

it('mirrors gameplay documents and OTA state, excluding private scopes and aside copies', () => {
  for (const key of ['wildshard.save.v2.global', 'wildshard.save.v2.profile', 'wildshard.save.v2.pine-hollow', 'ws.ota.x']) expect(isMirroredSave(key, ['pine-hollow'])).toBe(true);
  for (const key of ['wildshard.save.v2.device', 'wildshard.save.v2.session', 'wildshard.save.v2.pine-hollow.corrupt.now', 'ws.inventory.v1', 'wildshard.save.v2.unknown-level']) expect(isMirroredSave(key, ['pine-hollow'])).toBe(false);
});
