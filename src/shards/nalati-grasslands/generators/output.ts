import { bakeSheepBody } from './sheepBody';
import questContent from '../data/questContent.json' with {type:'json'};
import namePanel from '../data/namePanel.json' with {type:'json'};
import { parsePanelDefinition } from '@wildshard/format/panelTemplate';
import weather from '../data/weather.json' with {type:'json'};
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';

const sheepBody = bakeSheepBody();

/** Author weather once; page and native owners consume the same admitted numeric program. */
const emitted=emitNamedBlobs([nameBlob('actors/sheep.bin', 'bin', sheepBody.bytes),nameBlob('actors/sheep.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ row: sheepBody.row, pivots: sheepBody.pivots, parts: sheepBody.parts, radius: sheepBody.radius }))),nameBlob('quests/content.json','json',new TextEncoder().encode(encodeCanonicalJson(questContent))),nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ name: parsePanelDefinition(namePanel) }))),nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weather))))]);
export const output={namedFiles:emitted.files,assets:emitted.assets};
