import BRIDGE_SPANS from '../data/bridgeRows.json' with { type: 'json' };
import { bridgeDeck, bridgeFacts, bridgePosts } from './ropeBridge.ts';
import { driftwoodGroundSampler } from './groundSampling.ts';

/** Two existing spans: native island bridge and flat-ground Explorer specimen. */
export function originalBridgeFacts() {
  return [bridgeFacts(BRIDGE_SPANS.world,driftwoodGroundSampler()),bridgeFacts(BRIDGE_SPANS.specimen,()=>0)];
}

/** The same two spans' static anchor posts, own space; the deck stays live. */
export function originalBridgePosts() {
  return { world: bridgePosts(BRIDGE_SPANS.world,driftwoodGroundSampler()), specimen: bridgePosts(BRIDGE_SPANS.specimen,()=>0) };
}

/** The same two spans' posts, planks and ropes skinned to their deck segments, own space (the live deck's one draw). */
export function originalBridgeDecks() {
  return { world: bridgeDeck(BRIDGE_SPANS.world,driftwoodGroundSampler()), specimen: bridgeDeck(BRIDGE_SPANS.specimen,()=>0) };
}
