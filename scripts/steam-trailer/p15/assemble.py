"""TRAILERS P15 (E472): cut one 15-second player cinematic from its LTX shots, on its score's hits.

  python3 scripts/steam-trailer/p15/assemble.py <crossing|party|leap> <P15 scratch dir>

Each shot (<scratch>/shots/<id>.mp4, 1280 × 704, 24 fps) is conformed to 1920 × 1080 (scaled to 1964 × 1080, centre-
cropped, 60 fps; `speed` < 1 slows it), cut at `in` for `dur` seconds, then edit.mjs lays the corner tag on the content,
the end card over a hold of the last frame, and the mix (score + Stable Audio 3 hits, −14 LUFS) → <scratch>/out/<name>.mp4.
The cut points sit on the score take's onsets (scratch `hits.py`): crossing 4.00 / 5.65 / 9.20, party 6.00, leap 3.45 /
7.65. Titles: `titles.mjs <scratch>/titles scripts/steam-trailer/p15/titles.json`; the tag is CT2's cbug.png.
"""
import json, os, subprocess, sys

NAME, D = sys.argv[1], sys.argv[2]
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CUTS = {  # (shot, in s, dur s, speed); the content ends where the end card starts
    'crossing': {'score': 'p15-crossing/minimax3-601.wav', 'end': 12.5, 'clips': [
        ('x1', 0.0, 4.0, 1.0), ('x2', 0.6, 1.1, 1.0), ('x2-r1', 0.0, 0.55, 0.5), ('x3-r1', 0.0, 3.55, 1.0), ('x4', 0.3, 3.3, 1.0)],
        'sfx': [('p15-gallop', 0.0, -12, 5.6, 0.3), ('p15-whoosh', 5.45, -9, None, 0), ('p15-splash', 5.75, -6, None, 0),
                ('p15-gallop', 6.6, -14, 5.9, 0.5), ('p15-hit', 12.5, -5, None, 0)]},
    'party': {'score': 'p15-party/minimax3-601.wav', 'end': 12.0, 'clips': [
        ('p1', 0.2, 2.5, 1.0), ('p2', 0.5, 3.5, 1.0), ('p3', 0.0, 6.0, 0.83)],
        'sfx': [('p15-steps', 0.0, -10, 6.0, 0.4), ('p15-rumble', 5.6, -5, None, 0), ('p15-blades', 9.3, -6, None, 0),
                ('p15-hit', 12.0, -5, None, 0)]},
    'leap': {'score': 'p15-leap/minimax3-601.wav', 'end': 12.4, 'clips': [
        ('l1', 0.0, 1.4, 1.0), ('l2-r1', 0.0, 3.5, 1.0), ('l3', 0.0, 2.75, 1.0), ('l4', 0.0, 4.75, 0.85)],
        'sfx': [('p15-wind', 1.3, -9, 3.6, 0.4), ('p15-whoosh', 4.75, -8, None, 0), ('p15-rain', 4.9, -15, 7.5, 0.5),
                ('p15-dragon', 8.6, -5, None, 0), ('p15-hit', 12.4, -5, None, 0)]},
}
C = CUTS[NAME]
work = os.path.join(D, 'work', NAME); os.makedirs(work, exist_ok=True)
out = os.path.join(D, 'out'); os.makedirs(out, exist_ok=True)
ff = lambda *a: subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)

clips, at = [], 0.0
for shot, tin, dur, speed in C['clips']:
    src = os.path.join(D, 'shots', f'{shot}.mp4')
    conf = os.path.join(work, f'{shot}.mp4')
    pts = f'setpts={1 / speed:.4f}*PTS,' if speed != 1.0 else ''
    ff('-i', src, '-vf', f'{pts}scale=1964:1080:flags=lanczos,crop=1920:1080,fps=60', '-an', '-c:v', 'libx264', '-crf', '14',
       '-pix_fmt', 'yuv420p', conf)
    clips.append({'at': round(at, 3), 'shot': shot, 'in': tin, 'dur': dur, 'video': conf})
    at += dur
assert abs(at - C['end']) < 0.02, (NAME, at, C['end'])

# the end card's background: the last content frame held under a slow push
last = os.path.join(work, 'last.png')
ff('-sseof', '-0.05', '-i', os.path.join(work, f"{C['clips'][-1][0]}.mp4"), '-frames:v', '1', '-update', '1', last)
endbg = os.path.join(work, 'endbg.mp4')
tail = 15 - C['end']
ff('-loop', '1', '-framerate', '60', '-t', f'{tail + 0.05:.2f}', '-i', last, '-vf',
   "zoompan=z='1.02+0.0003*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=60",
   '-t', f'{tail + 0.05:.2f}', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', endbg)
clips.append({'at': C['end'], 'shot': 'endbg', 'in': 0, 'dur': round(tail, 3), 'video': endbg})
edl = {'length': 15, 'clips': clips, 'titles': [{'id': 'end', 'card': 'endC', 'at': C['end'], 'dur': round(tail, 3)}],
       'overlays': [{'png': os.path.join(D, 'titles', 'cbug.png'), 'from': 0, 'to': C['end']}]}
json.dump(edl, open(os.path.join(work, 'edl.json'), 'w'), indent=1)

inputs, chains, labels = ['-i', os.path.join(D, 'score', C['score'])], ['[0:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:15.5[m]'], ['[m]']
for k, (fam, t, gain, keep, fade) in enumerate(C['sfx']):
    p = os.path.join(D, 'sfx-best', f'tr-{fam}.wav')
    if not os.path.exists(p):
        continue
    inputs += ['-i', p]
    n = len(labels)
    trim = f',atrim=0:{keep}' if keep else ''
    fo = f',afade=t=out:st={max(0, (keep or 2) - fade)}:d={fade}' if fade else ''
    chains.append(f'[{n}:a]aformat=sample_rates=48000:channel_layouts=stereo{trim}{fo},volume={gain}dB,adelay={int(t * 1000)}|{int(t * 1000)}[s{k}]')
    labels.append(f'[s{k}]')
chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,atrim=0:15,afade=t=out:st=14.2:d=0.8,"
              'loudnorm=I=-14:TP=-1.0:LRA=11[a]')
mix = os.path.join(work, 'mix.wav')
ff(*inputs, '-filter_complex', ';'.join(chains), '-map', '[a]', '-ar', '48000', mix)
subprocess.run(['node', os.path.join(R, 'scripts/steam-trailer/edit.mjs'), work, os.path.join(work, 'edl.json'),
                os.path.join(D, 'titles'), mix, os.path.join(out, f'{NAME}.mp4')], check=True)
print('[p15]', os.path.join(out, f'{NAME}.mp4'))
