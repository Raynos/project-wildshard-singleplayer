// Dev entry: the score — src/audio/Music.ts on its own (fast) or on top of the real world (?world=1).
// http://localhost:5173/dev/music.html            buttons: play / states / stings; a stats line every second
// http://localhost:5173/dev/music.html?world=1    the bootstrapped chunk under it (CPU while the game renders)
// window.__music = { Music, music, audio, renderWav(name, seconds) → base64 WAV } — scripts/music/render.mjs drives this headlessly.
import { Audio } from '../audio/Audio';
import { Music, type MusicMode, type MusicState, type Shard, type StingName } from '../audio/Music';
import type { ArrangementName } from '../audio/score/wildshard-theme';

const params = new URLSearchParams(location.search);
const audio = new Audio();
const music = new Music(audio);

const renderWav = async (name: ArrangementName, seconds: number, solo?: string[], state?: Partial<MusicState>): Promise<string> => {
  const buf = await Music.renderOffline(name, seconds, { solo, state });
  const bytes = new Uint8Array(Music.toWav(buf));
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCodePoint(...bytes.subarray(i, i + CH));
  return btoa(s);
};

const ui = document.getElementById('music-dev');
if (!ui) throw new Error('music-dev: #music-dev element missing');
const btn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', () => { audio.resume(); fn(); }); ui.append(b); };
btn('play theme', () => music.play('theme'));
btn('play trailer30', () => music.play('trailer30'));
btn('play trailer15', () => music.play('trailer15'));
btn('stop', () => music.stop());
for (const m of ['menu', 'calm', 'alert', 'combat'] as MusicMode[]) btn(m, () => music.setState({ mode: m, intensity: m === 'combat' ? 0.8 : 0.4 }));
for (const s of ['pine', 'island'] as Shard[]) btn(s, () => music.setState({ shard: s }));
btn('underwater', () => music.setState({ underwater: !music.state.underwater }));
for (const s of ['pickup', 'death', 'chunk'] as StingName[]) btn(`sting ${s}`, () => music.sting(s));
const pre = document.createElement('pre'); ui.append(pre);
let oscPeak = 0;
setInterval(() => {
  const st = music.stats, live = music.engine.liveOsc(); oscPeak = Math.max(oscPeak, live);
  pre.textContent = `ctx ${audio.ctx.state} t=${audio.ctx.currentTime.toFixed(1)}  ${JSON.stringify(music.state)}\nbars ${st.bars} notes ${st.notes} osc live ${live} (peak ${oscPeak}) sched ${st.schedMs.toFixed(1)} ms total, max ${st.schedMax.toFixed(2)} ms/bar`;
}, 250);
(window as unknown as { __oscPeak: () => number }).__oscPeak = () => oscPeak;

(window as unknown as { __music: unknown }).__music = { Music, music, audio, renderWav };

if (params.has('world')) {
  const { bootstrap } = await import('../core/bootstrap');
  const world = await bootstrap();
  world.game.buildComposer(); world.game.start();
  (window as unknown as { __world: unknown }).__world = world;
}
