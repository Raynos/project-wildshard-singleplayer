import { nativeAssemblyFiles, type NativeAssemblyPlan, type ServerBlob } from '@wildshard/sharddev/blobs';
import assembly from '../data/headlessAssembly.json' with { type: 'json' };
import grappleProfile from '../data/grappleProfile.json' with { type: 'json' };
import portals from '../data/portals.json' with { type: 'json' };
import { headlessConstants } from './headless';

/** The owner tag of the Well's safety cap, whose colliders open while a claw flies through. */
const GRAPPLE_GUARD = 'nds-grapple-guard';

/** Nine's native assembly (P1-E3.1b, J90): a world of baked pieces with no terrain or population, and its hosts in install order. */
function nineNativeAssembly(entries: { readonly lanes: number; readonly steps: number; readonly portalTransfers: number }): NativeAssemblyPlan {
  return { kind: 'native-assembly', level: { speed: 5, ground: { size: 500, height: 0 }, stand: headlessConstants.spawnY }, terrain: { kind: 'flat' }, navigation: 'shard',
    entries: { proven: { lanes: entries.lanes, steps: entries.steps, portalTransfers: entries.portalTransfers } },
    features: [{ host: 'collision.pieces', rows: { file: 'server/pieces.json' } }, { host: 'item.swept', policy: { file: 'server/jian.json' } },
      { host: 'portal.ride', step: assembly.constants.portalStep, rows: { file: 'server/portal-ride.json' } },
      { host: 'grapple', mode: 'grapple', profile: { file: 'server/grapple-profile.json' }, hooks: { file: 'server/hooks.json' }, guard: GRAPPLE_GUARD, rise: true }] };
}

/** Nine's server class (J91): the plan and the rows it names, on no client path. */
export function nineServerFiles(entries: Parameters<typeof nineNativeAssembly>[0]): ServerBlob[] {
  const { pieces, hooks } = headlessConstants, { director, trigger, fade, landings } = portals;
  return nativeAssemblyFiles(nineNativeAssembly(entries), new Map<string, unknown>([['server/pieces.json', pieces], ['server/jian.json', assembly.constants.jianPolicy],
    ['server/portal-ride.json', { director, trigger, fade, landings }], ['server/grapple-profile.json', grappleProfile], ['server/hooks.json', hooks]]));
}
