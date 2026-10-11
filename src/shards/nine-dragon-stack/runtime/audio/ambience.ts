import { Vector3 } from 'three';
import { runtimeAudio } from '@wildshard/game/plugin/audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { ZoneWeights } from '@wildshard/engine/audio/AmbienceBeds';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import { castRay } from '@wildshard/engine/physics/query';
import { lanternAudioPositions } from '../../look/lanterns';
import { requireAudioProfile, type AudioZoneProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';
import { ndCueMap, bindTraversalCue } from './cues';
import { ndScore } from './files';

const PROFILE = requireAudioProfile(source.audio.zones, 'ambience.nd');

interface Rect { x0: number; x1: number; z0: number; z1: number }
function distance(rect: Rect, pos: Pick<Vector3, 'x' | 'z'>): number {
  return Math.hypot(Math.max(rect.x0 - pos.x, 0, pos.x - rect.x1), Math.max(rect.z0 - pos.z, 0, pos.z - rect.z1));
}
/** Prepare admitted region bounds once; listener ticks keep the native distance law. */
export function prepareNdZones(profile: AudioZoneProfile): (pos: Pick<Vector3, 'x' | 'z'>) => ZoneWeights {
  const rectangles = requireAudioProfile(profile.rectangles, 'nd.rectangles');
  const wellBounds = requireAudioProfile(rectangles.find((row) => row.id === 'well'), 'nd.well');
  const market = rectangles.filter((row) => row.zone === 'market');
  const blend = requireAudioProfile(profile.blendMetres, 'nd.blend');
  return (pos) => {
    const toWell = distance(wellBounds, pos), toMarket = Math.min(...market.map((row) => distance(row, pos)));
    const well = Math.min(1, Math.max(0, 0.5 + (toMarket - toWell) / blend));
    return { market: 1 - well, well };
  };
}
const legacyZones = prepareNdZones(PROFILE);
/** A six-metre blend centred on the market/Well boundary; outside the built market remains market ambience. */
export function ndZones(pos: Pick<Vector3, 'x' | 'z'>): ZoneWeights { return legacyZones(pos); }
export async function installAudio(ctx: ShardContext): Promise<void> {
  const rows = runtimeAudio(ctx, source.audio);
  const profile = requireAudioProfile(rows.zones, 'ambience.nd'), musicProfile = requireAudioProfile(rows.music, 'score.nd');
  const bedsRows = requireAudioProfile(profile.beds, 'nd.beds'), positional = requireAudioProfile(profile.positional, 'nd.positional');
  const zones = prepareNdZones(profile);
  const [{ AmbienceBeds, PositionalLoops }, { CuePlayer }] = await Promise.all([import('@wildshard/engine/audio/AmbienceBeds'), import('@wildshard/engine/audio/Cues')]);
  const audio = ctx.app.audio;
  if (audio?.music === null || audio === null) throw new Error('Nine Dragon kit needs the audio/music service');
  const music = audio.music, random = (): number => ctx.app.rng.stream('cosmetic').next();
  const score = await ndScore(() => { music.refreshScore(); }, musicProfile);
  const player = new CuePlayer(audio, ctx.scope, random), map = ndCueMap(player, random, rows.routing);
  ctx.scope.onDispose(music.setScore(musicProfile.id, score));
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
  const beds = new AmbienceBeds(audio, ctx.scope, bedsRows.map((row) => ({ id: row.id, zone: row.zone, sample: () => player.loop(row.id),
    started: requireAudioProfile(started.get(row.id), row.id) })), zones, profile.smoothSeconds * 3, random);
  audio.installBeds(bedsRows.map((row) => row.id), ctx.scope, () => beds.audible.length);
  const hums = new PositionalLoops(audio, ctx.scope, lanternAudioPositions(), () => player.loop(positional.sample),
    () => { tap.sound?.('nd.hum.lantern', 'ambient'); }, random, positional.max, positional.reach);
  const eye = new Vector3();
  let since = 0, elapsed = 0, chimeIn = 8 + random() * 12;
  let listener: Vector3 | null = null;
  const tick = (): void => {
    const pos = listener;
    if (pos === null) return;
    const weights = zones(pos), well = weights['well'] ?? 0;
    if (score.scene.well !== well) { score.scene.well = well; music.refreshScore(); }
    beds.update(pos);
    eye.copy(pos); eye.y += 1.68; hums.update(eye, audio.listenerYaw);
    if (!audio.ready || audio.worldMuted || well <= 0.5) return;
    chimeIn -= elapsed;
    if (chimeIn <= 0) { map('chime.gust', { gain: 0.4 }); chimeIn = 8 + random() * 12; }
  };
  ctx.system({ id: 'shard.nd.audio', phase: 'update', after: ['engine.player.update'], run: (dt) => {
    const pos = audio.listenerPosition;
    if (pos === null || ctx.app.clock.paused) return;
    since += dt;
    if (since < 1 / profile.tickHz) return;
    elapsed = since; since = 0; listener = pos;
    ambientTick('nd.audio.tick', tick);
  } });
  ctx.debug.expose('nd.audio', { score: musicProfile.id, beds: audio.bedIds, lanterns: () => hums.count });
}
