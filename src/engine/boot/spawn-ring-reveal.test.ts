import {expect, test} from 'vitest';
import {isDev, setDev} from '../core/devMode';
import {jsonSlot} from '../saves/slots';
import {spawnRingReveal, setSpawnRingReveal} from './spawnRingReveal';
import {DEBUG_ROWS} from '../ui/debugOptions';

test('only the one Developer reload row can select early spawn readiness; saved picks never affect public entry', () => {
  const developer = isDev(), saved = jsonSlot('debug.spawnRingReveal', 'device'), previous = saved.read();
  try {
    setDev(true); setSpawnRingReveal(false); expect(spawnRingReveal()).toBe(false);
    const rows = DEBUG_ROWS.filter(row => row.id === 'spawnRingReveal');
    expect(rows).toHaveLength(1);
    const row = rows[0]; if (row === undefined) throw new Error('Missing Developer row');
    expect(row).toMatchObject({purpose: 'developer', group: 'loading', label: 'Reveal at 3x3 spawn ring', reload: true});
    expect(row.get()).toBe('off');
    row.set('on'); expect(spawnRingReveal()).toBe(true);
    setDev(false); expect(spawnRingReveal()).toBe(false);
    row.set('off'); setSpawnRingReveal(false);
    setDev(true); expect(spawnRingReveal()).toBe(true);
    row.set('off'); expect(spawnRingReveal()).toBe(false);
    saved.write('on'); expect(spawnRingReveal()).toBe(false);
  } finally {setDev(true); saved.write(previous); setDev(developer);}
});
