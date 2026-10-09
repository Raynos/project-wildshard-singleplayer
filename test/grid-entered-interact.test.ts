import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Interactable } from '../src/engine/world/interact/types';
import { enteredRuntime, pickInFrame, type EnteredRuntimeState } from '../src/game/grid/enteredInteract';

// grid-interact (E435): inside an entered grid cell the page scans only that cell's own runtime prompts, in its frame.
// Two runtime cells, each with a prompt at the same frame-local spot, and the home's prompt at that spot in the home frame.
const prompt = (label: string, x: number, z: number): Interactable => ({ label, position: new Vector3(x, 1, z), radius: 3, onInteract: () => undefined });
const home = [prompt('Talk to the castaway', 10, 228)];
const cells = {
  sky: { origin: { x: 0, z: -555 }, list: [prompt('Ride the islet', 0, 228)] },
  pine: { origin: { x: 555, z: 0 }, list: [prompt('Pick up', 0, 228)] },
} as const;
type Cell = keyof typeof cells;
const homeOrigin = { x: 0, z: 0 };
/** what the page scans for a state: the home's list in the home frame, the entered cell's list, else nothing */
const scanned = (state: EnteredRuntimeState): readonly Interactable[] => {
  if (state.current === 'home') return home;
  const instance = enteredRuntime(state);
  return instance === null ? [] : cells[instance as Cell].list;
};
/** the camera as the page holds it during update: frame-local feet + eye height, plus the applied render origin */
const view = (frame: Cell | 'home', local: { x: number; z: number }): { camera: Vector3; offset: { x: number; y: number; z: number } } => {
  const origin = frame === 'home' ? homeOrigin : cells[frame].origin, offset = { x: origin.x - homeOrigin.x, y: 0, z: origin.z - homeOrigin.z };
  return { camera: new Vector3(local.x + offset.x, 1.7, local.z + offset.z), offset };
};
const pick = (state: EnteredRuntimeState, frame: Cell | 'home', local: { x: number; z: number }): string | undefined => {
  const { camera, offset } = view(frame, local);
  return pickInFrame(scanned(state), camera, offset, null, new Vector3())?.label;
};
const at = (instance: string | null, ready: boolean, current: string | null, feetCell: string | null): EnteredRuntimeState => ({ hybrid: { instance, ready }, current, feetCell });

describe('grid cell interaction prompts (grid-interact)', () => {
  it('offers the entered cell\'s own prompt in its frame (the camera less the render origin)', () => {
    expect(pick(at('sky', true, 'sky', 'sky'), 'sky', { x: 0, z: 227.8 })).toBe('Ride the islet');
    expect(pick(at('pine', true, 'pine', 'pine'), 'pine', { x: 0, z: 227.8 })).toBe('Pick up');
    // without taking the render origin off, the page-space camera is a whole cell away: the old bug (no prompt)
    const { camera } = view('sky', { x: 0, z: 227.8 });
    expect(pickInFrame(cells.sky.list, camera, { x: 0, y: 0, z: 0 }, null, new Vector3())).toBeUndefined();
  });

  it('scans exactly one runtime: never a parked neighbour\'s, nor the home\'s at its local spot in another frame', () => {
    const sky = at('sky', true, 'sky', 'sky');
    expect(scanned(sky)).toBe(cells.sky.list);
    expect(pick(sky, 'sky', { x: 10, z: 228 })).toBeUndefined(); // the castaway's home-frame spot, in Sky Reach: no home prompt
    expect(pick(at('home', false, 'home', 'home'), 'home', { x: 10, z: 228 })).toBe('Talk to the castaway');
  });

  it('offers nothing mid-crossing: before the next cell\'s hooks complete, with the feet still across the seam, or on the road', () => {
    expect(enteredRuntime(at('pine', false, 'pine', 'pine'))).toBeNull(); // entering: hooks not complete
    expect(enteredRuntime(at('sky', true, 'pine', 'pine'))).toBeNull(); // the frame moved on before the hybrid did
    expect(enteredRuntime(at('sky', true, 'sky', 'pine'))).toBeNull(); // motor-frame hysteresis: feet already in the next cell
    expect(enteredRuntime(at('sky', true, null, null))).toBeNull(); // the road
    expect(pick(at('pine', false, 'pine', 'pine'), 'pine', { x: 0, z: 227.8 })).toBeUndefined();
    expect(pick(at('sky', true, 'sky', 'pine'), 'sky', { x: 0, z: 227.8 })).toBeUndefined();
  });
});
