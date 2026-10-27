import { parse, type InferOutput } from 'valibot';
import { FILE_SCHEMAS } from './sections';
import authored from '../data/bridgeRows.json' with { type: 'json' };

/** Admit the unchanged authored endpoints before either native bridge constructor reads them. */
export const BRIDGE_SPANS: InferOutput<typeof FILE_SCHEMAS['data/bridgeRows.json']> = parse(FILE_SCHEMAS['data/bridgeRows.json'], authored);
