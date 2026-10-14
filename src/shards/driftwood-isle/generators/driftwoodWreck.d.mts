import type { wreckSite } from './wreckSite';
import type { BufferGeometry } from 'three';
/** The authored world and Explorer draws on their two fixed sites. */
export function originalWreck(): {
  world: ReturnType<typeof wreckSite>;
  specimen: { geometry: BufferGeometry; glow: BufferGeometry };
};
