import type * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import type { Flutter } from './Flutter';
import type { Balbals } from './Balbals';
import type { Box } from './solid';
import type { PoiPiece, Plumes, KurganEntrance, Ledge } from './types';

export interface NalatiPOIs {
 group: THREE.Group; pieces: PoiPiece[]; flutter: Flutter; smoke: Plumes;
 colliders: Box[]; timings: Record<string, number>; balbals: Balbals | null;
 kurganEntrance: KurganEntrance | null; cragLedges: Ledge[];
 cragCave: KurganEntrance | null; cairnTieSpot: THREE.Vector3 | null;
 placed: Map<string, readonly Placed[]>;
 update: (dt: number) => void; stats: () => Record<string, number>;
}
