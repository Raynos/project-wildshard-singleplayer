import { jsonSlot } from '../saves/slots';
import { isDev } from '../core/devMode';

/** pause ▸ Settings ▸ Debug ▸ Graph back-end (nine-fix NF14, G935): graph materials as TSL node materials (shipped) or as
 *  classic GLSL programs (`render/graph/glslMaterial.ts`). */
export const GRAPH_BACKENDS = ['tsl', 'glsl'] as const;
export type GraphBackendChoice = (typeof GRAPH_BACKENDS)[number];
const saved = jsonSlot('debug.graphBackend', 'device');

/** The saved pick; Developer only (off: the shipped TSL). Read when a shard's materials load: the row reloads the page. */
export function graphBackendChoice(): GraphBackendChoice {
  const value = saved.read();
  return isDev() ? GRAPH_BACKENDS.find(choice => choice === value) ?? 'tsl' : 'tsl';
}
/** Save a pick (the Debug row; the page reloads). */
export function setGraphBackend(value: GraphBackendChoice): void { saved.write(value); }
