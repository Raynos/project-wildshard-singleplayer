import type { HeadlessAssemblyModules } from '@wildshard/sdk/headlessAssembly';
import { addBakedPieces as m0addBakedPieces, proveEntryways as m0proveEntryways } from '@wildshard/game/plugin/simulation';
import { tagOf as m1tagOf } from '@wildshard/engine/physics/surface';
import { portalLinkEntries as m2portalLinkEntries } from '@wildshard/format/portalLinkAssets';
import { installNineJian as m3installNineJian, JIAN_ID as m3JIAN_ID } from '../runtime/jian';
import { installNineGrapple as m4installNineGrapple, GRAPPLE_LOCK as m4GRAPPLE_LOCK, GRAPPLE_AIM as m4GRAPPLE_AIM } from '../runtime/grapple';
import { installHostRide as m5installHostRide } from '../runtime/portals/hostRide';
import { walkInRide as m6walkInRide, playerRider as m6playerRider, declaredPortals as m6declaredPortals } from '../runtime/portals/walkInRide';
import { rideFeats as m7rideFeats } from '../world/feats';

/** Explicit session capabilities; checked against the product declaration. */
export const headlessModules = {
  '@wildshard/game/plugin/simulation': { addBakedPieces: m0addBakedPieces, proveEntryways: m0proveEntryways },
  '@wildshard/engine/physics/surface': { tagOf: m1tagOf },
  '@wildshard/format/portalLinkAssets': { portalLinkEntries: m2portalLinkEntries },
  'src/shards/nine-dragon-stack/runtime/jian': { installNineJian: m3installNineJian, JIAN_ID: m3JIAN_ID },
  'src/shards/nine-dragon-stack/runtime/grapple': { installNineGrapple: m4installNineGrapple, GRAPPLE_LOCK: m4GRAPPLE_LOCK, GRAPPLE_AIM: m4GRAPPLE_AIM },
  'src/shards/nine-dragon-stack/runtime/portals/hostRide': { installHostRide: m5installHostRide },
  'src/shards/nine-dragon-stack/runtime/portals/walkInRide': { walkInRide: m6walkInRide, playerRider: m6playerRider, declaredPortals: m6declaredPortals },
  'src/shards/nine-dragon-stack/world/feats': { rideFeats: m7rideFeats },
} satisfies HeadlessAssemblyModules;
