// src/game/quest/guards.ts — the iron sword stays guarded while a drowned sailor is up, whatever the saved flags say:
// after a reload (he is placed again) or a night respawn, the rack is his again until he falls.
import { describe, expect, it } from 'vitest';
import { ironSwordGuard, SWORD_GUARDED } from '../src/game/quest/guards';

const sailor = (alive: boolean) => ({ kind: 'sailor', alive });
const crab = (alive: boolean) => ({ kind: 'crab', alive });

describe('ironSwordGuard', () => {
  it('guarded while a sailor is alive', () => {
    expect(ironSwordGuard([crab(true), sailor(true)])).toBe(SWORD_GUARDED);
  });
  it('free once every sailor is down (a corpse does not guard)', () => {
    expect(ironSwordGuard([sailor(false), crab(true)])).toBeNull();
  });
  it('a reload: the saved fight is won but the sailor stands again → guarded again', () => {
    const afterReload = [sailor(true)];   // Enemies.ts places him on every load; `dead:sailor` is still saved
    expect(ironSwordGuard(afterReload)).toBe(SWORD_GUARDED);
  });
  it('a night respawn beside the old corpse: the new one guards', () => {
    expect(ironSwordGuard([sailor(false), sailor(true)])).toBe(SWORD_GUARDED);
  });
  it('no sailor on the shard at all → nothing to guard it', () => {
    expect(ironSwordGuard([crab(true)])).toBeNull();
    expect(ironSwordGuard([])).toBeNull();
  });
});
