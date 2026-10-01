import type * as QuestContent from './content';
/** Quest views are loaded after the Node-safe manifest pass. */
export function loadQuest(): Promise<typeof QuestContent> { return import('./content'); }
