import type { BufferGeometry } from 'three';
import type { bridgeFacts } from './ropeBridge';
/** Native island and Explorer rest plans, evaluated offline. */
export declare function originalBridgeFacts(): ReturnType<typeof bridgeFacts>[];
/** The island and Explorer spans' anchor posts in their own space. */
export declare function originalBridgePosts(): { world: BufferGeometry; specimen: BufferGeometry };
