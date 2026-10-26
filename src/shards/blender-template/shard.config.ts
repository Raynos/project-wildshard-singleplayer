import { emptyShardfile } from '@wildshard/sdk/author';
import SOURCE from './data/source.json' with { type: 'json' };
import content from './data/content.json' with { type: 'json' };
import ROWS from './data/rows.json' with { type: 'json' };
import HALL_QUEST from './quests/hall.json' with { type: 'json' };

type ProjectOverlay<Current, Added> = Omit<Current, keyof Added> & Added;
type BlenderProject = ProjectOverlay<ProjectOverlay<ProjectOverlay<ReturnType<typeof emptyShardfile>, typeof SOURCE>, typeof content>, { rows: typeof ROWS; quests: typeof HALL_QUEST }>;

const base: ReturnType<typeof emptyShardfile> = emptyShardfile(SOURCE.identity);
/** The SDK compiles and meters the door, then admits its critical bytes. */
export const behaviour: { id: string; source: string; maximumPages: number; }[] = [{ id: 'door', source: 'behaviour/door.as', maximumPages: 2 }];
// G166 clay look and G532 baked ground remain authored in source.json.
// The labelled card's existing hash-named image and measured costs are in content.json.
const project: BlenderProject = { ...base, ...SOURCE, ...content, rows: ROWS, quests: HALL_QUEST };

// oxlint-disable-next-line import/no-default-export -- The SDK loads the author declaration.
export default project;
/** Explicit standalone author-source ceiling; no frozen legacy denominator. */
export const buildOptions = { asLineCeiling: 256 };
