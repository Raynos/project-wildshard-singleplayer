import { Vector3 } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ZoneWeights } from '@wildshard/engine/audio/AmbienceBeds';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import { castRay } from '@wildshard/engine/physics/query';
import { lanternAudioPositions } from '../../look/lanterns';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';
import { ndCueMap, bindTraversalCue } from './cues';
import { ndScore } from './files';

const PROFILE = requireAudioProfile(source.audio.zones, 'ambience.nd');
const MUSIC = requireAudioProfile(source.audio.music, 'score.nd');
const RECTANGLES = requireAudioProfile(PROFILE.rectangles, 'nd.rectangles');
const WELL = requireAudioProfile(RECTANGLES.find((row) => row.id === 'well'), 'nd.well');
const MARKET = RECTANGLES.filter((row) => row.zone === 'market');
const BLEND = requireAudioProfile(PROFILE.blendMetres, 'nd.blend');
const BEDS = requireAudioProfile(PROFILE.beds, 'nd.beds');
const POSITIONAL = requireAudioProfile(PROFILE.positional, 'nd.positional');

interface Rect { x0: number; x1: number; z0: number; z1: number }
function distance(rect: Rect, pos: Pick<Vector3, 'x' | 'z'>): number {
  return Math.hypot(Math.max(rect.x0 - pos.x, 0, pos.x - rect.x1), Math.max(rect.z0 - pos.z, 0, pos.z - rect.z1));
}
/** A six-metre blend centred on the market/Well boundary; outside the built market remains market ambience. */
export function ndZones(pos: Pick<Vector3, 'x' | 'z'>): ZoneWeights {
  const toWell = distance(WELL, pos), toMarket = Math.min(...MARKET.map((row) => distance(row, pos)));
  const well = Math.min(1, Math.max(0, 0.5 + (toMarket - toWell) / BLEND));
  return { market: 1 - well, well };
}
export async function installAudio(ctx: ShardContext): Promise<void> {
  const [{ AmbienceBeds, PositionalLoops }, { CuePlayer }] = await Promise.all([import('@wildshard/engine/audio/AmbienceBeds'), import('@wildshard/engine/audio/Cues')]);
  const audio = ctx.app.audio;
  if (audio?.music === null || audio === null) throw new Error('Nine Dragon kit needs the audio/music service');
  const music = audio.music, random = (): number => ctx.app.rng.stream('cosmetic').next();
  const score = await ndScore(() => { music.refreshScore(); });
  const player = new CuePlayer(audio, ctx.scope, random), map = ndCueMap(player, random);
  ctx.scope.onDispose(music.setScore(MUSIC.id, score));
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
  const started = new Map<string, () => void>([
    ['bed.nd.market', () => { tap.sound?.('bed.nd.market', 'ambient'); }],
    ['bed.nd.well', () => { tap.sound?.('bed.nd.well', 'ambient'); }],
  ]);
  const beds = new AmbienceBeds(audio, ctx.scope, BEDS.map((row) => ({ id: row.id, zone: row.zone, sample: () => player.loop(row.id),
    started: requireAudioProfile(started.get(row.id), row.id) })), ndZones, PROFILE.smoothSeconds * 3, random);
  audio.installBeds(BEDS.map((row) => row.id), ctx.scope, () => beds.audible.length);
  const hums = new PositionalLoops(audio, ctx.scope, lanternAudioPositions(), () => player.loop(POSITIONAL.sample),
    () => { tap.sound?.('nd.hum.lantern', 'ambient'); }, random, POSITIONAL.max, POSITIONAL.reach);
  const eye = new Vector3();
  let since = 0, chimeIn = 8 + random() * 12;
  ctx.system({ id: 'shard.nd.audio', phase: 'update', after: ['engine.player.update'], run: (dt) => {
    const pos = audio.listenerPosition;
    if (pos === null || ctx.app.clock.paused) return;
    since += dt;
    if (since < 1 / PROFILE.tickHz) return;
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
  ctx.debug.expose('nd.audio', { score: MUSIC.id, beds: audio.bedIds, lanterns: () => hums.count });
}
