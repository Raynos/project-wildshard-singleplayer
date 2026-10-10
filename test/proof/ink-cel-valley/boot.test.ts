import { expect, it } from 'vitest';
import { nativeProof } from './native';

it('boots the authored ink valley through the declared factory in plain Node', () => {
  const output = nativeProof('boot'); expect(output).toContain('"entities":3'); expect(output).toContain('"encounters":2'); expect(output).toContain('"terrain":true');
});
