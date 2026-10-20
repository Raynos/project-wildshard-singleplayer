/**
 * Driftwood's level against the road (SHARD-PLATFORM SF46, Jake's G164: "lower the whole world 0.8m including island …
 * make the sea 0.8m deeper too you just fucking align it"; G172: shipped, the old level deleted). The island was authored
 * round a waterline at +0.8 m (`SHORE_LEVEL`: its landscape and its offline bake keep it). The whole world is lowered
 * `WORLD_DROP` together: the terrain (the manifest's field, and its bake through the field's `datum`), the seabed, the sea,
 * the pier, jetties and boat, every prop and collider placed on them, the Blender cove, the movers. The sea rests at road
 * height (y = 0) and nothing moves relative to anything else.
 *
 * `DRIFTWOOD_SEA` is the manifest's registered `sea` water body: the lowered sea, clipped out of the entry sockets and
 * (in a grid cell) at the shore revetment's inner face, so swimming, wading, the camera's water line and the minimap
 * all read road height. It is the declared row itself (`declaredWaterBody`, which stops a confined sea at the shore
 * revetment's inner face, G149).
 */
import { declaredWaterBody } from '@wildshard/engine/world/water/declared';
import sea from '../boot/sea.generated.json' with { type: 'json' };

/** the lowered sea's rest level: road height */
export const LOWERED_SEA = sea.DECLARED_SEA.level;
/** the registered open sea: the lowered sea at road height, clipped out of the entry sockets and at the revetment */
export const DRIFTWOOD_SEA = declaredWaterBody(sea.DECLARED_SEA);
