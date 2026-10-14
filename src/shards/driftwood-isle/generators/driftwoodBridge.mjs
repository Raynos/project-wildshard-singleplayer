import { BRIDGE_SPANS } from '../data/bridgeRows.ts';
import { bridgeFacts } from './ropeBridge.ts';
import { driftwoodGroundSampler } from './groundSampling.ts';

/** Two existing spans: native island bridge and flat-ground Explorer specimen. */
export function originalBridgeFacts() {
  return [bridgeFacts(BRIDGE_SPANS.world,driftwoodGroundSampler()),bridgeFacts(BRIDGE_SPANS.specimen,()=>0)];
}
