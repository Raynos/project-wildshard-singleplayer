"""TRAILERS T15 (E471): finish one 15-second variant from its 12 s content clip.

  python3 scripts/steam-trailer/t15/assemble.py <variant> <T15 scratch dir>

<scratch>/<variant>/content.mp4 (12.0 s, 1920 × 1080, 60 fps) + a 3 s end card over its own last frame (a slow push) →
edit.mjs (the corner tag CONCEPT TRAILER · NOT GAMEPLAY on the content, the end card titles, the finish) with a mix of
the variant's score take and its sound effects at −14 LUFS → <scratch>/out/<variant>.mp4. Titles come from
`titles.mjs <scratch>/titles scripts/steam-trailer/t15/titles.json`; the corner tag is CT2's `cbug.png`
(`<scratch>/titles/cbug.png`). SCORE and SFX below say which take and which hits each variant uses.
"""
import json, os, subprocess, sys

V, D = sys.argv[1], sys.argv[2]
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SCORE = {  # the picked MiniMax take per variant (score/<key>/minimax3-<seed>.wav)
    'v1-glyphs': 't15-v1/minimax3-501.wav', 'v2-map': 't15-v2/minimax3-501.wav',
    'v3-postcards': 't15-v3/minimax3-502.wav', 'v4-seam': 't15-v4/minimax3-502.wav',
}
# (family, at seconds, gain dB, seconds to keep or None, fade-out s)
SFX = {
    'v1-glyphs': [('t15-typing', 0.5, -10, 2.9, 0.15), ('t15-enter', 3.35, -8, None, 0), ('t15-glyphs', 6.45, -9, None, 0)],
    'v2-map': [('t15-pen', 0.1, -13, 8.0, 0.6), ('t15-pen', 8.0, -17, 3.6, 1.0)],
    'v3-postcards': [('t15-card', 0.5, -6, None, 0), ('t15-card', 2.1, -6, None, 0), ('t15-card', 3.7, -6, None, 0),
                     ('t15-card', 5.3, -6, None, 0), ('t15-slide', 6.5, -8, None, 0), ('t15-typing', 8.15, -11, 2.3, 0.15)],
    'v4-seam': [('t15-wind', 0.0, -12, 12.0, 0), ('t15-wind', 11.5, -16, 3.5, 2.5)],
}
if os.environ.get('T15_NOSFX'):  # a picture check before the sound effects exist
    SFX[V] = []
OVERRIDE = os.path.join(D, V, 'mix.json')  # a variant may carry its own placements (e.g. a lane's timing)
if os.path.exists(OVERRIDE):
    o = json.load(open(OVERRIDE)); SCORE[V] = o.get('score', SCORE[V]); SFX[V] = [tuple(x) for x in o.get('sfx', SFX[V])]

out = os.path.join(D, 'out'); os.makedirs(out, exist_ok=True)
work = os.path.join(D, 'work', V); os.makedirs(work, exist_ok=True)
ff = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)
content = os.path.join(D, V, 'content.mp4')

# the end card's background: the content's last frame, held, pushing in slowly
last = os.path.join(work, 'last.png')
ff('-sseof', '-0.05', '-i', content, '-frames:v', '1', '-update', '1', last)
endbg = os.path.join(work, 'endbg.mp4')
ff('-loop', '1', '-framerate', '60', '-t', '3.05', '-i', last, '-vf',
   "zoompan=z='1.02+0.0003*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=60",
   '-t', '3.05', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', endbg)

titles = [{'id': 'end', 'card': 'endC', 'at': 12, 'dur': 3}]
if V == 'v4-seam':
    titles.insert(0, {'id': 'cap-v4', 'card': 'bigcap', 'at': 5.2, 'dur': 6.4})
edl = {'length': 15, 'clips': [
    {'at': 0, 'shot': 'content', 'in': 0, 'dur': 12, 'video': content},
    {'at': 12, 'shot': 'endbg', 'in': 0, 'dur': 3, 'video': endbg}],
    'titles': titles,
    'overlays': [{'png': os.path.join(D, 'titles', 'cbug.png'), 'from': 0, 'to': 12}]}
json.dump(edl, open(os.path.join(work, 'edl.json'), 'w'), indent=1)

# the mix: score + hits, loudness-normalised, 15 s with a short tail fade
inputs, chains, labels = ['-i', os.path.join(D, 'score', SCORE[V])], ['[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:15.5[m]'], ['[m]']
for k, (fam, at, gain, keep, fade) in enumerate(SFX[V]):
    inputs += ['-i', os.path.join(D, 'sfx-best', f'tr-{fam}.wav')]
    trim = f',atrim=0:{keep}' if keep else ''
    fo = f',afade=t=out:st={max(0, (keep or 2) - fade)}:d={fade}' if fade else ''
    chains.append(f'[{k + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo{trim}{fo},volume={gain}dB,adelay={int(at * 1000)}|{int(at * 1000)}[s{k}]')
    labels.append(f'[s{k}]')
chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,atrim=0:15,afade=t=out:st=14.2:d=0.8,"
              'loudnorm=I=-14:TP=-1.0:LRA=11[a]')
mix = os.path.join(work, 'mix.wav')
ff(*inputs, '-filter_complex', ';'.join(chains), '-map', '[a]', '-ar', '48000', mix)

subprocess.run(['node', os.path.join(R, 'scripts/steam-trailer/edit.mjs'), work, os.path.join(work, 'edl.json'),
                os.path.join(D, 'titles'), mix, os.path.join(out, f'{V}.mp4')], check=True)
print('[t15]', os.path.join(out, f'{V}.mp4'))
