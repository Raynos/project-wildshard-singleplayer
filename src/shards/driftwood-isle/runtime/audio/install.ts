import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import type { ShardContext } from '@wildshard/game/shard/context';
import { swordEvents } from '@wildshard/kit/weapons/melee/SweptMelee';
import { SHRINE } from '../../manifest';
import { LOWERED_SEA } from '../../world/sea';
import { driftwoodWorld } from '../../world/build';
import { Cove } from '../../world/Cove';
import { IslandSfx } from './sfx';
import { SurfaceMap } from './surface';
import { IslandAmbience } from './ambience';
import { ShrineHum } from './shrineHum';
import { driftwoodCueMap } from './cues';
import { installDriftwoodScore } from './score';
import { driftwoodAudioSystems } from './systems';

/** Runs in level.play after the shell supplies its host. Constructors make no cosmetic draws. */
export async function installDriftwoodAudio(ctx: ShardContext): Promise<void> {
  const shell = ctx.game.runtime;
  if (shell?.world === undefined || shell.world === null || shell.play === null) throw new Error('Driftwood audio requires its play host');
  const { game, sky, player } = shell.world, { audio, music } = shell.play;
  installDriftwoodScore(audio, music, ctx.scope);
  const built = driftwoodWorld(shell), { trailDistance } = await import('@wildshard/engine/world/Heightfield');
  const shrineHum = built.shrine === null ? null : new ShrineHum(audio, music, { x: SHRINE.x, y: heightAt(SHRINE.x, SHRINE.z) + 2.5, z: SHRINE.z });
  const islandSfx = new IslandSfx(audio, ctx.scope);
  const sea = LOWERED_SEA; // SF46 (G164): the lowered sea at road height
  const surfaces = new SurfaceMap({ sea, heightAt, trailDistance,
    decks: [built.pier, ...built.jetties, built.boat, built.hut, built.lookout, built.bridge, built.wreck], stone: [built.shrine] });
  const ambience = new IslandAmbience(audio, { sea, heightAt, palms: built.palmSpecs, wreck: built.wreck, cove: Cove.forIsland() });
  const cues = driftwoodCueMap(islandSfx, player);
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
  driftwoodAudioSystems(ctx, game.camera, { clock: () => sky.dayNight, shrine: built.shrine, hum: shrineHum, ambience });
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
