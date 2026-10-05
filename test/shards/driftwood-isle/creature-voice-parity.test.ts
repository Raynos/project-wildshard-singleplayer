// oxlint-disable-next-line import/no-nodejs-modules -- This native parity oracle hashes the original kit's Float32 samples; it never ships to the browser.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { CREATURE_VOICES, vocal, windup } from '../../../src/shards/driftwood-isle/runtime/audio/creatureVoices';

// Captured before moving the original kit module (blob 253cb5badfdb1d76c61c33921bcd09c738c97c0e).
// Every voice/windup, three seeds, and both full/half-rate bank paths: 42 complete Float32 buffers.
const original = [
  { sr: 24000, samples: 401009, hash: 'dad94897bdf74f921a633d723a2d9ff61f62c704db0d7ac0f56f2e706a1b06d8' },
  { sr: 48000, samples: 802019, hash: '4c283f1dbb8e6328cdd976a19102a4f5e4d22d3e0d57bc69f539ff08bca43fa5' },
];

it.each(original)('preserves every original creature-voice sample at $sr Hz', ({ sr, samples, hash }) => {
  const digest = createHash('sha256');
  let count = 0;
  const variants = [
    ...CREATURE_VOICES.map((name) => ({ kind: 'vocal', name, render: (rate: number, seed: number) => vocal(name, rate, seed) })),
    ...(['boar', 'crab', 'sailor'] as const).map((name) => ({ kind: 'windup', name, render: (rate: number, seed: number) => windup(name, rate, seed) })),
  ];
  for (const { kind, name, render } of variants) for (const seed of [1, 2, 3]) {
    const buffer = render(sr, seed);
    count += buffer.length;
    digest.update(JSON.stringify([kind, name, sr, seed, buffer.length]));
    digest.update(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  }
  expect(count).toBe(samples);
  expect(digest.digest('hex')).toBe(hash);
});
