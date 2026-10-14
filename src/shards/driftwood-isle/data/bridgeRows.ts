import type { RopeBridgeSpec } from '../models/ropeBridge';
/** The two authored rope-bridge sites; both the native world and offline rest author use these rows. */
export const BRIDGE_SPANS: Record<'world'|'specimen',RopeBridgeSpec> = {
  world:{a:[16,14],b:[32,30],sag:0.9},
  specimen:{a:[0,0],b:[12,0],sag:0.9},
};
