import { parseQuestData } from '@wildshard/sdk/quests';
import { DRIFTWOOD_QUEST } from '../quest/questLine';

// Declared markers carry their stable IDs; the trusted placement port restores the original POI/anchor/dy recipe.
const markers = [...(DRIFTWOOD_QUEST.intro?.markers ?? []), ...DRIFTWOOD_QUEST.steps.flatMap(step => step.markers ?? [])];
export const DRIFTWOOD_MARKERS = Object.fromEntries(markers.map(marker => [marker.id, marker.at]));
const declaredMarker = (marker: (typeof markers)[number]) => ({ ...marker, at: { poi: 'world' as const, x: marker.at.x, z: marker.at.z } });
const reads = (condition: { all?: readonly string[]; any?: readonly string[]; none?: readonly string[] } | undefined): readonly string[] => [...(condition?.all ?? []), ...(condition?.any ?? []), ...(condition?.none ?? [])];
const declaredStep = (step: (typeof DRIFTWOOD_QUEST.steps)[number]) => ({ ...step, markers: step.markers?.map(declaredMarker) ?? [] });
export const DRIFTWOOD_QUESTS = parseQuestData({
  flags: [...new Set([DRIFTWOOD_QUEST.completeFlag, ...reads(DRIFTWOOD_QUEST.startWhen), ...DRIFTWOOD_QUEST.steps.flatMap(step => [...reads(step.done), ...(step.count ?? [])]), ...markers.flatMap(marker => reads(marker.hideWhen))])],
  quests: [{ ...DRIFTWOOD_QUEST,
    ...(DRIFTWOOD_QUEST.intro === undefined ? {} : { intro: { ...DRIFTWOOD_QUEST.intro, markers: DRIFTWOOD_QUEST.intro.markers?.map(declaredMarker) ?? [] } }),
    steps: DRIFTWOOD_QUEST.steps.map(declaredStep),
    onComplete: { fact: 'driftwood.quest' } }],
  triggers: [], dialogue: [],
});
