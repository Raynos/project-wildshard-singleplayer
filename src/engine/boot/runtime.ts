import type * as ExploreModule from '../explore/Explore';
import type * as FeedbackModule from '../ui/Feedback';
/** Mechanisms loaded once after the composition root selects the level. */

export function loadExplore(): Promise<typeof ExploreModule> { return import('../explore/Explore'); }
export function loadFeedback(): Promise<typeof FeedbackModule> { return import('../ui/Feedback'); }

