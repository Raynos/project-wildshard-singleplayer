import type { PineSources } from './pineSources';

/** One hero source's shapes, colliders and materials. */
export interface HeroFacts {
  id: string; near: string; far: string; colliders: { kind: string; x: number; y: number; z: number; surface: string; points?: number[]; hx?: number; hy?: number; hz?: number }[];
  material: { near: string; far: string };
  open?: { near: string; far: string };
  closed?: { plane: string; colliders: HeroFacts['colliders']; material: { kind: string; properties: { color: number; roughness: number; metalness: number } } };
}
/** The hero facts and each shape's GLB by product name, built once per sources (src/shards/pine-hollow/generators/bake-hero-scenes.mjs). */
export function pineHeroScenes(sources: PineSources): Promise<{ sources: HeroFacts[]; glbs: [string, Uint8Array][] }>;
