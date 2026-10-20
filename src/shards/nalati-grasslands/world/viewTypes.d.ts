import type * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import type { EncounterSites } from '@wildshard/game/boss/encounterView';
import type { Box } from './solid';
import type { KurganEntrance, Ledge } from './types';

export interface NalatiPOIs {
 group: THREE.Group;
 colliders: Box[]; balbals: EncounterSites | null;
 kurganEntrance: KurganEntrance | null; cragLedges: Ledge[];
 cairnTieSpot: THREE.Vector3 | null;
 placed: Map<string, readonly Placed[]>;
 update: (dt: number) => void;
}
