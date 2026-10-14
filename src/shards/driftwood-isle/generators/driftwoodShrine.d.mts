import type { ShrineBuilder } from './shrine';
import type { BufferGeometry } from 'three';

interface ShrineBake {
  geometry:{kit:BufferGeometry;water:BufferGeometry;glyphs:BufferGeometry};
  rows:{origin:{x:number;y:number;z:number};colliders:ShrineBuilder['colliders'];descs:ReturnType<ShrineBuilder['colliderDescs']>;
    anchors:ShrineBuilder['anchors'];baseY:number;waterY:number;terrace:number};
}
/** The original world and Explorer geometry with their independent native layouts. */
export function originalShrine():{world:ShrineBake;specimen:ShrineBake};
