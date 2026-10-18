import { Vector3 } from 'three';
import { runtimeAudio } from '@wildshard/game/plugin/audio';
import type { ShardContext } from '@wildshard/game/shard/context';
import { SampledAmbience } from '@wildshard/engine/audio/AmbienceBeds';
import { tap, ambientTick } from '@wildshard/engine/core/harnessTap';
import { castRay } from '@wildshard/engine/physics/query';
import { lanternAudioPositions } from '../../look/lanterns';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';
import { ndCueMap, bindTraversalCue } from './cues';


export async function installAudio(ctx: ShardContext): Promise<void> {
  const rows = runtimeAudio(ctx, source.audio);
  const profile = requireAudioProfile(rows.zones, 'ambience.nd'), musicProfile = requireAudioProfile(rows.music, 'score.nd');
  const positional = requireAudioProfile(profile.positional, 'nd.positional');
  const [{ PositionalLoops }, { CuePlayer }, { SetScore }] = await Promise.all([import('@wildshard/engine/audio/AmbienceBeds'), import('@wildshard/engine/audio/Cues'), import('@wildshard/engine/audio/SetScore')]);
  const audio = ctx.app.audio;
  if (audio?.music === null || audio === null) throw new Error('Nine Dragon kit needs the audio/music service');
  const music = audio.music, random = (): number => ctx.app.rng.stream('cosmetic').next();
  const score = SetScore.declared(musicProfile, music);
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
  const beds = new SampledAmbience(audio, profile, player, ctx.scope);
  ctx.scope.onDispose(() => { beds.dispose(); });
  audio.installBeds(requireAudioProfile(profile.beds, 'nd.beds').map(row => row.id), ctx.scope, () => beds.audible.length);
  const hums = new PositionalLoops(audio, ctx.scope, lanternAudioPositions(), () => player.loop(positional.sample),
    () => { tap.sound?.('nd.hum.lantern', 'ambient'); }, random, positional.max, positional.reach);
  const eye = new Vector3(), bedInputs = { x: 0, z: 0 };
  let since = 0, elapsed = 0;
  let listener: Vector3 | null = null;
  const tick = (): void => {
    const pos = listener;
    if (pos === null) return;
    bedInputs.x = pos.x; bedInputs.z = pos.z; beds.set(bedInputs);
    const well = requireAudioProfile(beds.values.get('wellWeight'), 'well weight');
    if (score.scene['well'] !== well) { score.scene['well'] = well; music.refreshScore(); }
    beds.mix();
    eye.copy(pos); eye.y += 1.68; hums.update(eye, audio.listenerYaw);
    beds.inputs['worldOn'] = Number(!audio.worldMuted);
    beds.advance(elapsed, pos, audio.listenerYaw);
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
