import { loadModuleWithProgress } from '../ui/loadProgress';
import type * as ExploreModule from '../explore/Explore';
import type * as FeedbackModule from '../ui/Feedback';
/** Optional UI code loads on its first request, with owned preparation progress. */

export function loadExplore(): Promise<typeof ExploreModule> { return loadModuleWithProgress('Explore', () => import('../explore/Explore')); }
export function loadFeedback(): Promise<typeof FeedbackModule> { return loadModuleWithProgress('Feedback', () => import('../ui/Feedback')); }

