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
import * as THREE from 'three';
import { ColourRampFog } from '@wildshard/engine/world/Atmosphere';
import { DAY_LIGHT, RAMP_FOG } from '../data/toonLook';
import type { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';

/** the day light the clock turns (look/backdrop.ts); the sea sets its caustics' level */
export const dayLight = {
  uToonLift: { value: new THREE.Color(...DAY_LIGHT.uToonLift) }, uToonRim: { value: new THREE.Color(...DAY_LIGHT.uToonRim) },
  uCloudShadow: { value: DAY_LIGHT.uCloudShadow }, uToonNight: { value: DAY_LIGHT.uToonNight }, uSeaLevel: { value: DAY_LIGHT.uSeaLevel }, uCloudTime: { value: DAY_LIGHT.uCloudTime },
};

/**
 * L3 — colour-ramp fog (Firewatch): distance × height. Before its start the island is crisp; out to its end the colour
 * ramps from a cool aerial blue-violet into the sky dome's own gradient in that direction (so the sea's horizon dissolves
 * into the sky seamlessly), warmer toward the sun; high ground keeps more contrast than the water line. The engine's
 * exponential terms still run (with Driftwood's thin dry densities) so the underwater blend in Atmosphere.ts works.
 */
export const rampFog = new ColourRampFog(RAMP_FOG);

/** The catalogue's live toon look (the graph toon materials', data/reefLook.ts) as it follows the day light, once a frame. */
export function followToon(look: Awaited<ReturnType<typeof runtimeLookMaterials>>['toon']): () => void {
  const u = dayLight, t = look.uniforms;
  return () => { t.famToonLift.value.copy(u.uToonLift.value); t.famToonRim.value.copy(u.uToonRim.value); t.famToonCloud.value.x = u.uCloudShadow.value; t.famToonWater.value.x = u.uSeaLevel.value; t.famToonTime.value = u.uCloudTime.value; };
}
