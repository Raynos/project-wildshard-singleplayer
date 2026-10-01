import type * as WorldContent from './world/content';

/** Authored world builders are loaded after manifest discovery. */
export function loadWorldContent(): Promise<typeof WorldContent> { return import('./world/content'); }
