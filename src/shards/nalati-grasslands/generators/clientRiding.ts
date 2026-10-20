import { parse } from 'valibot';
import { ClientRidingSessionSchema } from '@wildshard/format/riding';
import paint from '../data/poiPaint.json' with { type: 'json' };
import reins from '../data/reins.json' with { type: 'json' };
import ridingPrograms from '../behaviour/riding.generated.json' with { type: 'json' };
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import nativeRide from '../data/nativeRiding.json' with { type: 'json' };
import headlessBoot from '../data/headlessBoot.json' with { type: 'json' };
import namePanel from '../data/namePanel.json' with { type: 'json' };
import mountedFigure from '../data/mountedFigure.json' with { type: 'json' };
import { headlessAssembly } from './nativeGroups';

/** Native session rows preserve the same programs, hitch point and naming UI. */
export const NALATI_RIDING_SESSION = parse(ClientRidingSessionSchema, {preset:ridingPrograms.client,programs:{...ridingPrograms,reins},profile:{speeds:ecology.modes.ride[0].gaits,thrownDamage:nativeRide.thrownDamage,thrownLabel:nativeRide.thrownLabel},roads:headlessBoot.roads,rest:headlessBoot.rest,taming:{binding:headlessAssembly.constants.nativeTaming.binding,rail:headlessAssembly.constants.nativeTaming.rail},naming:{panel:namePanel,action:'save',maximum:16,notice:'Your horse is ',bondedFeat:'tame'},figure:{row:mountedFigure,shapes:{binary:{url:'inline',bytes:0},shapes:[],inline:paint.rows.filter(row=>['shepherd-body','shepherd-arm'].includes(row.key)).map(({key,data,geometry})=>({key,data,geometry})),labels:[]},geometry:['shepherd-body','shepherd-arm']}});
