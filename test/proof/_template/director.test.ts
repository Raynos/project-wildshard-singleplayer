import { expect, it } from 'vitest';
import { nativeProof } from './native';

it('advances real door and wave owners through authored stages with a quiet exact native continuation', () => {
  expect(nativeProof('director')).toContain('"waveComplete":true');
}, 60_000);
