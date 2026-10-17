import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { SECTIONS } from '../sections';
/**
 * Driftwood's day light and colour-ramp fog (DRIFTWOOD-REMASTER L1, the user's pick D1: "toon two-band ramp + coloured
 * shadows + rim", BotW / Wind Waker / Rime). Every lit material on the island is a graph toon look (the toon family's light
 * model: a two-band sun ramp, coloured shade, a rim, cloud shade and caustics); the classic chunk patch it replaced (W2 C2)
 * is gone. The look declares
 *
 *   fog: rampFog.model(200)   // the engine's colour ramp, after its own fog (slot 100), before the sky
 *
 * The day / night clock turns `dayLight` (look/backdrop.ts); the graph toon looks follow it once a frame (`followToon`). Its
 * starting values are data in data/toonLook.ts.
 */
import { ToonArms } from '@wildshard/game/systems/viewmodel/toonArms';
import { ColourRampFog } from '@wildshard/engine/world/Atmosphere';
import type { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';

/** Day uniforms and fog are constructed by the product's render setup, never by importing this module. */
function createToon(product: ShardProduct) {
  const { FP_ARMS_LOOK: look, RAMP_FOG: fog } = product.section('custom/fixedLayouts', SECTIONS).nativeView;
  return { dayLight: ToonArms.lighting(look), rampFog: new ColourRampFog(fog) };
}
let current: ReturnType<typeof createToon> | null = null;
/** Session-called: initialize admitted toon state before building any view. */
export function prepareToon(product: ShardProduct): ReturnType<typeof createToon> { current ??= createToon(product); return current; }
/** Native meshes borrow the explicitly installed view state. */
export function toonState(): ReturnType<typeof createToon> {
  if (current === null) throw new Error('Driftwood toon state requires its admitted render setup');
  return current;
}

/** The catalogue's live toon look (the graph toon materials', data/reefLook.ts) as it follows the day light, once a frame. */
export function followToon(look: Awaited<ReturnType<typeof runtimeLookMaterials>>['toon']): () => void {
  const u = toonState().dayLight, t = look.uniforms;
  return () => { t.famToonLift.value.copy(u.uToonLift.value); t.famToonRim.value.copy(u.uToonRim.value); t.famToonCloud.value.x = u.uCloudShadow.value; t.famToonWater.value.x = u.uSeaLevel.value; t.famToonTime.value = u.uCloudTime.value; };
}
