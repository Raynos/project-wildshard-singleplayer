import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';
import type { SpeciesData } from '@wildshard/sdk/species';
import type { Mount } from '@wildshard/sdk/modes';
import type { FlockData } from '@wildshard/sdk/crowds';

/** Native population placement; the author resolves every layout anchor offline. */
export interface WildlifeLayout {
  packs: { x: number; z: number; variants: string[] }[];
  herds: { x: number; z: number; mares: number; foals: number; stallion: boolean }[];
  flocks: { x: number; z: number; count: number; dog: boolean; range?: number }[];
  marmots?: { sites: number; box: { x0: number; x1: number; z0: number; z1: number } };
  campHorses?: boolean;
}
type Gameplay = Pick<SpeciesData, 'aggressive' | 'walkSpeed' | 'chargeSpeed' | 'chargeDamage' | 'sounds' | 'tuning' | 'tick' | 'trampleRadius'>;
interface EliteRow {
  id: string; name: string; epithet: string;
  lair: { x: number; z: number; r: number };
  awareR: number; engageR: number; leashR: number;
  rule: 'always' | 'dusk' | 'night' | 'storm';
  respawnMin: number; once?: boolean; signature: string; phase2: string;
  drop: { skin: string | null; skinName: string; weapon: string; blurb: string; trophyName?: string };
}
/** JSON is the only runtime declaration; flock seeds are offsets until entry. */
export interface Ecology {
  argymaq: string;
  elites: Record<string, EliteRow>;
  wildlife: WildlifeLayout;
  mareVariants: string[];
  modes: { traverse: []; ride: [ReturnType<Mount['toModeData']>] };
  gameplay: { horse: Gameplay; wolf: Gameplay };
  species: { leopard: BrainedSpecies; eagle: BrainedSpecies; kokbori: BrainedSpecies };
  flocks: { world: FlockData[]; specimen: FlockData[] };
}
