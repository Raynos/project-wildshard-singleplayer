import persistence from '../data/persistence.generated.json' with {type:'json'};
import dressboulder from '../data/dressing-boulder.generated.json' with {type:'json'};
import dressslab from '../data/dressing-slab.generated.json' with {type:'json'};
import dressstone from '../data/dressing-stone.generated.json' with {type:'json'};
import dressjuniper from '../data/dressing-juniper.generated.json' with {type:'json'};
import dressrose from '../data/dressing-rose.generated.json' with {type:'json'};
import dresswillow from '../data/dressing-willow.generated.json' with {type:'json'};
import dresslupin from '../data/dressing-lupin.generated.json' with {type:'json'};
import dressdaisy from '../data/dressing-daisy.generated.json' with {type:'json'};
import dressreed from '../data/dressing-reed.generated.json' with {type:'json'};
import dresslogs from '../data/dressing-logs.generated.json' with {type:'json'};
import dressstumps from '../data/dressing-stumps.generated.json' with {type:'json'};
import dressovoos from '../data/dressing-ovoos.generated.json' with {type:'json'};
import dresspoles from '../data/dressing-poles.generated.json' with {type:'json'};
import dressfences from '../data/dressing-fences.generated.json' with {type:'json'};
import dressgates from '../data/dressing-gates.generated.json' with {type:'json'};
import dressdrifts from '../data/dressing-drifts.generated.json' with {type:'json'};
import dresscolliders from '../data/dressing-colliders.generated.json' with {type:'json'};
import dressclutter from '../data/dressing-clutter.generated.json' with {type:'json'};
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
const dressing = { boulder: dressboulder, slab: dressslab, stone: dressstone, juniper: dressjuniper, rose: dressrose, willow: dresswillow, lupin: dresslupin, daisy: dressdaisy, reed: dressreed, logs: dresslogs, stumps: dressstumps, ovoos: dressovoos, poles: dresspoles, fences: dressfences, gates: dressgates, drifts: dressdrifts, colliders: dresscolliders, clutter: dressclutter };
const emitted=emitNamedBlobs([nameBlob('quests/persistence.json','json',new TextEncoder().encode(encodeCanonicalJson(persistence))),...Object.entries(dressing).map(([key, rows]) => nameBlob(`world/dressing-${key}.json`, 'json', new TextEncoder().encode(encodeCanonicalJson(rows)))),nameBlob('actors/sheep.bin', 'bin', sheepBody.bytes),nameBlob('actors/sheep.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ row: sheepBody.row, pivots: sheepBody.pivots, parts: sheepBody.parts, radius: sheepBody.radius }))),nameBlob('quests/content.json','json',new TextEncoder().encode(encodeCanonicalJson(questContent))),nameBlob('quests/panels.json', 'json', new TextEncoder().encode(encodeCanonicalJson({ name: parsePanelDefinition(namePanel) }))),nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weather))))]);
export const output={namedFiles:emitted.files,assets:emitted.assets};
