import { expect, it } from 'vitest';
import { nativeProof } from './native';

it('grants the declared quest achievement once and dedupes after reopening the durable profile', () => {
  const output = nativeProof('ledger'); expect(output).toContain('"facts":1'); expect(output).toContain('"receipt":"duplicate"'); expect(output).toContain('"count":1');
});
