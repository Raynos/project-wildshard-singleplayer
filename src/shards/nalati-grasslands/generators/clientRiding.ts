import { parse } from 'valibot';
import { ClientRidingSessionSchema } from '@wildshard/format/riding';
import reins from '../data/reins.json' with { type: 'json' };
import type { NalatiRidingPrograms } from './ridingRows.mjs';
import ecology from '../data/ecology.generated.json' with { type: 'json' };
import nativeRide from '../data/nativeRiding.json' with { type: 'json' };
import headlessBoot from '../data/headlessBoot.json' with { type: 'json' };
import namePanel from '../data/namePanel.json' with { type: 'json' };
import assembly from '../data/headlessAssembly.json' with { type: 'json' };

/** Native session rows preserve the same programs, hitch point and naming UI (GR6: from the build's riding program). */
export function nalatiRidingSession(ridingPrograms: NalatiRidingPrograms): ReturnType<typeof parse<typeof ClientRidingSessionSchema>> {
  return parse(ClientRidingSessionSchema, {preset:ridingPrograms.client,programs:{...ridingPrograms,reins},profile:{speeds:ecology.modes.ride[0].gaits,thrownDamage:nativeRide.thrownDamage,thrownLabel:nativeRide.thrownLabel},roads:headlessBoot.roads,rest:headlessBoot.rest,taming:{binding:assembly.constants.nativeTaming.binding,rail:assembly.constants.nativeTaming.rail},naming:{panel:namePanel,action:'save',maximum:16,notice:'Your horse is ',bondedFeat:'tame'},figure:'riding/mounted-figure.json'});
}
