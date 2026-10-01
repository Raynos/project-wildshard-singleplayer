import { expect, it } from 'vitest';
import { isMirroredSave } from '#engine/native/saves';

it('mirrors gameplay documents and OTA state, excluding private scopes and aside copies', () => {
  for (const key of ['wildshard.save.v2.global', 'wildshard.save.v2.pine-hollow', 'ws.ota.x']) expect(isMirroredSave(key)).toBe(true);
  for (const key of ['wildshard.save.v2.device', 'wildshard.save.v2.session', 'wildshard.save.v2.pine-hollow.corrupt.now', 'ws.inventory.v1']) expect(isMirroredSave(key)).toBe(false);
});
