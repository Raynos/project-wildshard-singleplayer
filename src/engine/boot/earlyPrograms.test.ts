import {expect, test} from 'vitest';
import {queueBakedPrograms} from './earlyPrograms';

// sp-x8's C25: the baked entry list is optional. A read that fails before the renderer step reaches it (offline, an HTML
// fallback page that is not JSON) must settle as "no list", never as an unhandled rejection: the page turns those into
// a boot failure.
test('a baked list that rejects before the renderer step is no list, not an unhandled rejection', async () => {
  const unhandled: unknown[] = [], record = (reason: unknown): void => { unhandled.push(reason); };
  process.on('unhandledRejection', record);
  try {
    queueBakedPrograms(Promise.reject(new Error('offline')));
    // two macrotasks: Node reports an unhandled rejection after the microtask queue drains
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await new Promise(resolve => { setTimeout(resolve, 0); });
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', record);
  }
});
