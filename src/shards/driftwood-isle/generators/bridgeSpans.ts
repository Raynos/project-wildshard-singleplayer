import { readBridgeSpans } from './sections';
import authored from '../data/bridgeRows.json' with { type: 'json' };

/** Admit the unchanged authored endpoints before either native bridge constructor reads them. */
export const BRIDGE_SPANS: ReturnType<typeof readBridgeSpans> = readBridgeSpans(authored);
