// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the baked KTX2 headers under public/.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test resolves the public/ folder.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GPU_FILES as ENGINE } from '../../../src/engine/boot/ktx2.generated';
import { GPU_FILES as PINE } from '../../../src/shards/pine-hollow/ktx2.generated';
import { ASTC6_PHONE } from '../../../src/shards/pine-hollow/boot/astc6/ktx2.generated';

const PUB = resolve(import.meta.dirname, '../../../public');
/** a KTX2's vkFormat and supercompression (KTX2 header: vkFormat at 12, supercompressionScheme at 44) */
const header = (url: string): { vk: number; scheme: number } => {
  const b = readFileSync(resolve(PUB, `.${url}`));
  return { vk: b.readUInt32LE(12), scheme: b.readUInt32LE(44) };
};

describe('Pine memory trim G180 B2: the ASTC 6×6 phone overlay', () => {
  it('stands in only for URLs the phone tables already map, with a file that exists under Pine\'s astc6 folder', () => {
    const phone: Record<string, string> = { ...ENGINE.phone, ...PINE.phone };
    expect(Object.keys(ASTC6_PHONE).length).toBeGreaterThan(50);
    for (const [served, six] of Object.entries(ASTC6_PHONE)) {
      expect(phone[served], served).toBeDefined();
      expect(six.startsWith('/assets/pine-hollow/astc6/')).toBe(true);
      expect(existsSync(resolve(PUB, `.${six}`)), six).toBe(true);
    }
  });
  it('its standalone files are ASTC 6×6 (vkFormat 165 / 166), never an ETC1S plane', () => {
    for (const six of Object.values(ASTC6_PHONE).filter((url) => url.endsWith('.ktx2'))) {
      const { vk, scheme } = header(six);
      expect([165, 166], six).toContain(vk);
      expect(scheme, six).not.toBe(1);
    }
  });
});
