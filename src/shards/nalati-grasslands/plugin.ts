import { declaredRuntimeEntry } from '@wildshard/game/shard/declaredEntry';
import RuntimePlugin from './runtime/index';

/** Compatibility callers keep the unchanged trusted runtime hooks. */
export class NalatiPlugin extends RuntimePlugin {}

const entry = declaredRuntimeEntry(RuntimePlugin, RuntimePlugin, {
  entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: false,
});
export const resolveTrustedRuntime = entry.resolveTrustedRuntime;

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default entry.default;
