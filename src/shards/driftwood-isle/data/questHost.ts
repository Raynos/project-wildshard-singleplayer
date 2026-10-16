import { parseQuestHost } from '@wildshard/format/questHost';
import rows from './questRows.generated.json' with { type: 'json' };

export const QUEST_HOST = parseQuestHost(rows.host);
