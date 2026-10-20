import type { BufferGeometry } from 'three';
import type { bridgeFacts } from './ropeBridge';
/** Native island and Explorer rest plans, evaluated offline. */
export declare function originalBridgeFacts(): ReturnType<typeof bridgeFacts>[];
/** The island and Explorer spans' anchor posts in their own space. */
export declare function originalBridgePosts(): { world: BufferGeometry; specimen: BufferGeometry };
/** The island and Explorer spans' posts, planks and ropes skinned to their deck segments, own space. */
export declare function originalBridgeDecks(): { world: BufferGeometry; specimen: BufferGeometry };
