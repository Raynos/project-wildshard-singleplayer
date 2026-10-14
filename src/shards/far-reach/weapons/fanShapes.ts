import { BufferGeometry } from 'three';
import fanRows from '../data/fan.json' with { type: 'json' };
import { SKY_LIBRARY } from '../world/meshes';

export type FanShape = 'panels' | 'sticks' | 'straps' | 'guards' | 'rim' | 'plates' | 'strands' | 'hand';
/** Independent copies from the shared admitted pool; the same empty missing-asset view remains. */
export const fanShape = (name: FanShape | number): BufferGeometry => SKY_LIBRARY.geometry(`shape${typeof name === 'number' ? name : fanRows[name]}`) ?? new BufferGeometry();
