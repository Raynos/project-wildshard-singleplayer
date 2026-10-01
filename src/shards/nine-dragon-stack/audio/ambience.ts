import { Vector3 } from 'three';
import type { ShardContext } from '#game';
import { AmbienceBeds, PositionalLoops, CuePlayer, tap, ambientTick, castRay, type ZoneWeights } from '#engine';
import { lanternAudioPositions } from '../look/lanterns';
import { PLAZA, STREET, STAIR, WELL } from '../layout';
import { ndCueMap, bindTraversalCue } from './cues';
import { ndScore } from './files';

interface Rect { x0: number; x1: number; z0: number; z1: number }
function distance(rect: Rect, pos: Pick<Vector3, 'x' | 'z'>): number {
  return Math.hypot(Math.max(rect.x0 - pos.x, 0, pos.x - rect.x1), Math.max(rect.z0 - pos.z, 0, pos.z - rect.z1));
}
/** A six-metre blend centred on the market/Well boundary; outside the built market remains market ambience. */
export function ndZones(pos: Pick<Vector3, 'x' | 'z'>): ZoneWeights {
  const toWell = distance(WELL, pos), toMarket = Math.min(distance(PLAZA, pos), distance(STREET, pos), distance(STAIR, pos));
  const well = Math.min(1, Math.max(0, 0.5 + (toMarket - toWell) / 6));
  return { market: 1 - well, well };
}
export function installAudio(ctx: ShardContext): void {
  const audio = ctx.app.audio;
  if (audio?.music === null || audio === null) throw new Error('Nine Dragon kit needs the audio/music service');
  const music = audio.music, random = (): number => ctx.app.rng.stream('cosmetic').next();
  const score = ndScore(() => { music.refreshScore(); });
  const player = new CuePlayer(audio, ctx.scope, random), map = ndCueMap(player, random);
  ctx.scope.onDispose(music.setScore('score.nd', score));
  ctx.scope.onDispose(() => { score.dispose(); });
  audio.installCues(map, ctx.scope);
  ctx.scope.onDispose(bindTraversalCue(map));
  audio.onLevelBank((bank) => { player.useBank(bank.cues); score.useBank(bank.score); }, ctx.scope);
  const priorSurface = audio.stepSurface;
  audio.stepSurface = () => {
    const pos = audio.listenerPosition, physics = ctx.app.physics;
    if (pos === null || physics === null) return 'rock';
    const hit = castRay(physics, { x: pos.x, y: pos.y + 0.4, z: pos.z }, { x: 0, y: -1, z: 0 }, 1.5);
    return hit?.material === 'wood' || hit?.material === 'planks' ? 'planks' : hit?.material === 'metal' ? 'metal' : 'rock';
  };
  ctx.scope.onDispose(() => { audio.stepSurface = priorSurface; });
  const beds = new AmbienceBeds(audio, ctx.scope, [
    { id: 'bed.nd.market', zone: 'market', sample: () => player.loop('bed.nd.market'), started: () => { tap.sound?.('bed.nd.market', 'ambient'); } },
    { id: 'bed.nd.well', zone: 'well', sample: () => player.loop('bed.nd.well'), started: () => { tap.sound?.('bed.nd.well', 'ambient'); } },
  ], ndZones, 3, random);
  audio.installBeds(['bed.nd.market', 'bed.nd.well'], ctx.scope, () => beds.audible.length);
  const hums = new PositionalLoops(audio, ctx.scope, lanternAudioPositions(), () => player.loop('hum.lantern'),
    () => { tap.sound?.('nd.hum.lantern', 'ambient'); }, random, 4);
  const eye = new Vector3();
  let since = 0, chimeIn = 8 + random() * 12;
  ctx.system({ id: 'shard.nd.audio', phase: 'update', after: ['engine.player.update'], run: (dt) => {
    const pos = audio.listenerPosition;
    if (pos === null || ctx.app.clock.paused) return;
    since += dt;
    if (since < 0.25) return;
    const elapsed = since; since = 0;
    ambientTick('nd.audio.tick', () => {
      const weights = ndZones(pos), well = weights['well'] ?? 0;
      if (score.scene.well !== well) { score.scene.well = well; music.refreshScore(); }
      beds.update(pos);
      eye.copy(pos); eye.y += 1.68; hums.update(eye, audio.listenerYaw);
      if (!audio.ready || audio.worldMuted || well <= 0.5) return;
      chimeIn -= elapsed;
      if (chimeIn <= 0) { map('chime.gust', { gain: 0.4 }); chimeIn = 8 + random() * 12; }
    });
  } });
  ctx.debug.expose('nd.audio', { score: 'score.nd', beds: audio.bedIds, lanterns: () => hums.count });
}
