import type * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import type { EncounterSites } from '@wildshard/game/boss/encounterView';
import type { Box } from './solid';
import type { PoiPiece, KurganEntrance, Ledge } from './types';

export interface NalatiPOIs {
 group: THREE.Group; pieces: PoiPiece[];
 colliders: Box[]; timings: Record<string, number>; balbals: EncounterSites | null;
 kurganEntrance: KurganEntrance | null; cragLedges: Ledge[];
 cragCave: KurganEntrance | null; cairnTieSpot: THREE.Vector3 | null;
 placed: Map<string, readonly Placed[]>;
 update: (dt: number) => void; stats: () => Record<string, number>;
}
