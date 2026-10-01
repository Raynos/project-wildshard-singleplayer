/** Keep the engine's data-import boundary free of the runtime audio graph. */
import type * as AudioContent from './content';

export function loadAudio(): Promise<typeof AudioContent> { return import('./content'); }
