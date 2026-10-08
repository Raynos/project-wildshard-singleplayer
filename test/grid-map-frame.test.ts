// @vitest-environment happy-dom
// Playtest round 3: a grid resident registers its map pins, zone names and marks in its own cell's metres; the page's maps
// draw in the home's, so the resident's facades move them by the cell's offset (src/game/grid/mapFrame.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullMap, type MapPoi, type MapZone } from '../src/engine/ui/Map';
import { Minimap } from '../src/engine/ui/Minimap';
import { shiftedFullMap, shiftedMinimap } from '../src/game/grid/mapFrame';
import { legacyDouble } from './fake/FakeGame';

const maps: Minimap[] = [], fullMaps: FullMap[] = [];
beforeEach(() => {
  const gradient = legacyDouble<CanvasGradient>({ addColorStop: vi.fn<(offset: number, color: string) => void>() });
  const ctx = legacyDouble<CanvasRenderingContext2D>({ createRadialGradient: () => gradient, fillRect: vi.fn<(x: number, y: number, width: number, height: number) => void>() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
});
afterEach(() => { for (const full of fullMaps.splice(0)) full.scope.dispose(); for (const map of maps.splice(0)) map.scope.dispose(); document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('a grid resident\'s maps in the home frame', () => {
  it('moves its marks by the cell offset and leaves the home\'s own in place', () => {
    const map = new Minimap(); maps.push(map);
    const resident = shiftedMinimap(map, 555, -555);
    map.setMarks(() => [{ x: 1, z: 2, color: 'home' }]);
    const off = resident.addMarks(() => [{ x: 10, z: 20, color: 'quest' }]);
    expect(map.marks).toEqual([{ x: 1, z: 2, color: 'home' }, { x: 565, z: -535, color: 'quest' }]);
    resident.setMarks(() => [{ x: 0, z: 0, color: 'glass' }]);
    expect(map.marks[0]).toEqual({ x: 555, z: -555, color: 'glass' });
    off(); resident.setMarks(null); expect(map.marks).toEqual([]);
    expect(shiftedMinimap(map, 0, 0)).toBe(map);
  });
  it('moves its pins and zone names; everything else reads through', () => {
    const map = new Minimap(), full = new FullMap(map); maps.push(map); fullMaps.push(full);
    const addPois = vi.spyOn(full, 'addPois'), setPois = vi.spyOn(full, 'setPois'), setZones = vi.spyOn(full, 'setZones');
    const resident = shiftedFullMap(full, -555, 555);
    const pin: MapPoi = { x: 5, z: 6, label: 'THE RIDGE', kind: 'place' }, zone: MapZone = { x: 7, z: 8, label: 'OLD-GROWTH' };
    resident.addPois(() => [pin]); resident.setPois(() => [pin], { tally: true }); resident.setZones([zone]);
    expect(addPois.mock.calls[0]?.[0]()).toEqual([{ ...pin, x: -550, z: 561 }]);
    expect(setPois.mock.calls[0]?.[0]()).toEqual([{ ...pin, x: -550, z: 561 }]);
    expect(setPois.mock.calls[0]?.[1]).toEqual({ tally: true });
    expect(setZones.mock.calls[0]?.[0]).toEqual([{ ...zone, x: -548, z: 563 }]);
    resident.setQuest(() => ({ title: 'Pine', objective: 'o', hint: '' }));
    expect(full.quest?.title).toBe('Pine');
    expect(resident.zoom).toBe(full.zoom);
  });
});
