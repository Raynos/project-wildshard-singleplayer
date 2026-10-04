import { expect, it } from 'vitest';
import { runtimeVariantEnabled } from '../src/game/shard/runtimeVariant';

it('uses the synchronous saved Debug choice with an off default before preparing any loader', () => {
  const row = { id: 'fixture', group: 'loading', label: 'Fixture runtime', initial: 'off',
    ask: 'E435', reviewBy: '2026-10-11', note: 'Fixture runtime admission choice.',
    choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }] } as const;
  for (const choice of ['off', 'on']) {
    let registered = false;
    const enabled = runtimeVariantEnabled({ debugRow: (spec) => {
      registered = true; expect(spec.initial).toBe('off'); spec.change(choice);
    } }, row);
    expect(registered).toBe(true); expect(enabled).toBe(choice === 'on');
  }
});
