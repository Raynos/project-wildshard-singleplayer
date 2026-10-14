import { runtimeAudio, audioObserverSystems } from '@wildshard/game/plugin/audio';
import { requireAudioProfile } from '@wildshard/engine/audio/audioProfiles';
import source from '../../shard.config';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ShardContext } from '@wildshard/game/shard/context';
import { swordEvents } from '@wildshard/game/weapons/Sword';
import { SHRINE } from '../../manifest';
import { LOWERED_SEA } from '../../world/sea';
import { driftwoodWorld } from '../../world/build';
import { Cove } from '../../world/Cove';
import { IslandSfx } from './sfx';
import { ISLAND_SURFACES } from '../../data/audioSurfaces';
import { createIslandAmbience } from './ambience';
import { driftwoodCueMap } from './cues';
import { installDriftwoodScore } from './score';

/** Runs in level.play after the shell supplies its host. Constructors make no cosmetic draws. */
export async function installDriftwoodAudio(ctx: ShardContext): Promise<void> {
  const shell = ctx.game.runtime;
  if (shell?.world === undefined || shell.world === null || shell.play === null) throw new Error('Driftwood audio requires its play host');
  const { game, sky, player } = shell.world, { audio, music } = shell.play;
  const audioRows = runtimeAudio(ctx, source.audio);
  installDriftwoodScore(audio, music, ctx.scope, requireAudioProfile(audioRows.music, 'score.driftwood'));
  const built = driftwoodWorld(shell), { trailDistance } = await import('@wildshard/engine/world/Heightfield');
  const shrineHum = built.shrine === null ? null : audio.loopEmitter(requireAudioProfile(audioRows.emitters?.['shrine'],'shrine emitter'),requireAudioProfile(audioRows.loopGraphs,'audio loop graphs'),{position:{x:SHRINE.x,y:heightAt(SHRINE.x,SHRINE.z)+2.5,z:SHRINE.z},duck:gain=>{music.duck(gain);}});
  const islandSfx = new IslandSfx(audio, ctx.scope);
  const sea = LOWERED_SEA; // SF46 (G164): the lowered sea at road height
  const surfaces = audio.surfaceMap(requireAudioProfile(audioRows.surfaces,'island step surfaces'),ISLAND_SURFACES,{sea,heightAt,values:{trail:trailDistance},floors:{decks: [built.pier, ...built.jetties, built.boat, built.hut, built.lookout, built.bridge, built.wreck], stone: [built.shrine] } });
  const ambience = createIslandAmbience(audio, { wind: requireAudioProfile(audioRows.ambience ?? undefined,'ambience.island.wind'), sea, heightAt, palms: built.palmSpecs, wreck: built.wreck, cove: Cove.forIsland() }, requireAudioProfile(audioRows.zones, 'ambience.driftwood'));
  const cues = driftwoodCueMap(islandSfx, player, audioRows.routing);
  audio.installCues(cues, ctx.scope);
  ctx.answer('player.stepSurface', (request) => ({ ...request, surface: surfaces.surfaceAt(request.x, request.z, request.y) }));
  const old = { onSwing: swordEvents.onSwing, onStrike: swordEvents.onStrike, onClang: swordEvents.onClang, onCall: built.gulls?.onCall };
  swordEvents.onSwing = (speed, heavy, dir) => { cues('cue.weapon.fire', { speed, heavy, dir }); };
  swordEvents.onStrike = (kind, point, strength, killed) => {
    cues(`cue.hit.${kind === 'crab' ? 'shell' : kind === 'sailor' ? 'wood' : 'flesh'}`, { point, strength });
    if (killed) cues('cue.creature.death', { kind, point, gain: 1.3 });
  };
  swordEvents.onClang = (point, strength, clang) => { cues(`cue.weapon.clang.${clang}`, { point, strength }); };
  if (built.gulls) built.gulls.onCall = (point) => { cues('cue.ambient.gull', { point }); };
  // Water callbacks stay synchronous: dive/surface synth, plunge bank, mixer, zoned bed, score.
  const previousUnderwater = audio.setUnderwater.bind(audio);
  audio.setUnderwater = (on) => { previousUnderwater(on); ambience.setUnderwater(on); };
  const observers=audioObserverSystems(requireAudioProfile(audioRows.observations,'island audio observations'),{
    inputs:new Map([['clock',()=>sky.dayNight]]),
    writers:new Map<string,(value:number)=>void>([['shrine.dusk',value=>{built.shrine?.setDusk(value);}],['ambience.night',value=>{ambience.night=value;}]]),
    commands:new Map<string,NonNullable<ReturnType<Parameters<typeof audioObserverSystems>[1]['commands']['get']>>>([['hum',()=>{shrineHum?.update(game.camera);}],['ambience',(dt)=>{ambience.frame(dt,game.camera);}]])
  });
  for(let index=0;index<16;index++){const system=observers.systems[index];if(system!==undefined)ctx.system(system);}
  const handles = { shrineHum, islandSfx, surfaces, ambience };
  Object.assign(shell.objects, handles);
  ctx.debug.expose('driftwood.audio', handles);
  ctx.scope.onDispose(() => {
    swordEvents.onSwing = old.onSwing; swordEvents.onStrike = old.onStrike; swordEvents.onClang = old.onClang;
    if (built.gulls) { if (old.onCall === undefined) delete built.gulls.onCall; else built.gulls.onCall = old.onCall; }
    audio.setUnderwater = previousUnderwater;
    shrineHum?.dispose(); ambience.dispose();
    for (const [key, value] of Object.entries(handles)) if (shell.objects[key] === value) delete shell.objects[key];
  });
}
