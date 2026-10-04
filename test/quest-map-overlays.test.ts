// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapQuest } from '@wildshard/engine';
import { FullMap } from '../src/engine/ui/Map';
import { Minimap } from '../src/engine/ui/Minimap';
import { legacyDouble } from './fake/FakeGame';

const maps: Minimap[] = [], fullMaps: FullMap[] = [];
beforeEach(() => {
  const gradient = legacyDouble<CanvasGradient>({ addColorStop: vi.fn<(offset: number, color: string) => void>() });
  const ctx = legacyDouble<CanvasRenderingContext2D>({ createRadialGradient: () => gradient, fillRect: vi.fn<(x: number, y: number, width: number, height: number) => void>() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
});
afterEach(() => { for (const full of fullMaps.splice(0)) full.scope.dispose(); for (const map of maps.splice(0)) map.scope.dispose(); document.body.replaceChildren(); });

describe('quest overlays coexist with authored map sources', () => {
  it('keeps quest diamonds when the loot chart is replaced or cleared, then removes only its overlay', () => {
    const map = new Minimap(); maps.push(map);
    const quest = { x: 10, z: 12, color: '#8fe3ff' }, glass = { x: 20, z: 25, color: '#ffc070' };
    const off = map.addMarks(() => [quest]); map.setMarks(() => [glass]);
    expect(map.marks).toEqual([glass, quest]); map.setMarks(null); expect(map.marks).toEqual([quest]);
    map.setPracticeArena({ x: 0, z: 0 }); expect(map.marks).toEqual([]);
    map.setPracticeArena(null); expect(map.marks).toEqual([quest]);
    off(); off(); expect(map.marks).toEqual([]);
  });
  it('removes quest cards out of order and returns to the authored card without resurrecting a disposed one', () => {
    const map = new Minimap(), full = new FullMap(map); maps.push(map); fullMaps.push(full);
    const card = (title: string): MapQuest => ({ title, objective: title, hint: '' });
    full.setQuest(() => card('Authored'));
    const first = full.addQuest(() => card('First')), second = full.addQuest(() => card('Second'));
    expect(full.quest?.title).toBe('Second'); first(); expect(full.quest?.title).toBe('Second');
    map.setPracticeArena({ x: 0, z: 0 }); expect(full.quest).toBeNull();
    map.setPracticeArena(null); second(); expect(full.quest?.title).toBe('Authored');
  });
});
