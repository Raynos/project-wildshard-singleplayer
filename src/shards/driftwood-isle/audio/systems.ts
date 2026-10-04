import type { ShardContext } from '@wildshard/game/shard/context';
import type { Camera } from 'three';

interface AudioParts {
  clock: () => { readonly dusk: number; readonly night: number } | null;
  shrine: { setDusk: (value: number) => void } | null;
  hum: { update: (camera: Camera) => void } | null;
  ambience: { night: number; update: (dt: number, camera: Camera) => void };
}

/** The current shell ticks enemies in worldUpdate after the hands; dusk precedes both. */
export function driftwoodAudioSystems(ctx: Pick<ShardContext, 'system'>, camera: Camera, parts: AudioParts): void {
  ctx.system({ id: 'shard.driftwood.dusk', phase: 'update', before: ['main.world'], run: () => {
    const clock = parts.clock();
    if (clock) { parts.shrine?.setDusk(clock.dusk); parts.ambience.night = clock.night; }
  } });
  ctx.system({ id: 'shard.driftwood.shrineHum', phase: 'update', after: ['engine.audio.listener'], before: ['main.frame'], run: () => { parts.hum?.update(camera); } });
  ctx.system({ id: 'shard.driftwood.ambience', phase: 'update', after: ['shard.driftwood.shrineHum'], before: ['main.frame'], run: (dt) => { parts.ambience.update(dt, camera); } });
}
