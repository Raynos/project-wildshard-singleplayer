// The cut: one table for picture, titles and sound, timed to the score — per trailer, a config in cuts/.
//   node scripts/steam-trailer/cut.mjs <outDir> <musicTake.wav> <sfxDir> [--cut steam|nine-dragon]   → edl.json, titles.json, mix.json
//
// cuts/<name>.mjs default-exports cut({ TAKE, SFX }) → { edl: { length, clips, titles, size? }, titles, mix, report? }:
//   steam        E168, the 45 s Steam wishlist trailer (15 s per shard) on MiniMax take 204 (the default)
//   nine-dragon  E169 F3, the 15 s Nine Dragon Stack COMING SOON teaser (landscape; `--portrait` = the phone cut's EDL:
//                the same cut on the portrait captures, size 1080×1920)
import { writeFileSync, mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const [OUT, TAKE, SFX] = argv;
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i === -1 ? d : argv[i + 1]; };
const NAME = opt('cut', 'steam');
mkdirSync(OUT, { recursive: true });

const { default: cut } = await import(`./cuts/${NAME}.mjs`);
const { edl, titles, mix, report } = cut({ TAKE, SFX, portrait: argv.includes('--portrait') });

writeFileSync(`${OUT}/edl.json`, JSON.stringify(edl, null, 1));
writeFileSync(`${OUT}/titles.json`, JSON.stringify(titles, null, 1));
writeFileSync(`${OUT}/mix.json`, JSON.stringify(mix, null, 1));
console.log(edl.clips.map((c) => `${c.at.toFixed(2).padStart(6)}  ${c.shot.padEnd(11)} in ${c.in}  ${c.dur.toFixed(2)} s`).join('\n'));
if (report) console.log(report);
