#!/usr/bin/env python3
"""compose.py <edit.json> <out.mp4> — cut the progress video: shots (frame dirs) + cards + music, 1080x1920 30 fps.
edit: { music, musicStart, fade, segments: [{ dir, from (s), dur (s), card, cardIn, cardOut, quad: [dir, dir, dir, dir] }] }
Each segment becomes a clip; clips join with a short crossfade (edit.xfade seconds)."""
import json, os, subprocess, sys, tempfile
edit = json.load(open(sys.argv[1])); out = sys.argv[2]
P = os.path.dirname(os.path.abspath(sys.argv[1]))
FPS, X = 30, edit.get('xfade', 0.35)
tmp = tempfile.mkdtemp(dir=P, prefix='cut-')

def run(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], capture_output=True, text=True)
    if r.returncode: sys.exit(r.stderr[-2000:])

clips = []
for i, s in enumerate(edit['segments']):
    dur = s['dur'] + (X if i < len(edit['segments']) - 1 else 0)
    c = f'{tmp}/{i:02d}.mp4'
    ins, fc = [], []
    if 'quad' in s:
        for d in s['quad']:
            ins += ['-framerate', str(FPS), '-start_number', str(int(s.get('from', 0) * FPS)), '-i', f'{P}/{d}/%05d.jpg']
        fc.append(';'.join(f'[{k}]scale=540:960,setsar=1[q{k}]' for k in range(4)) + ';[q0][q1][q2][q3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v0]')
    else:
        ins += ['-framerate', str(FPS), '-start_number', str(int(s.get('from', 0) * FPS)), '-i', f'{P}/{s["dir"]}/%05d.jpg']
        fc.append('[0]scale=1080:1920,setsar=1[v0]')
    last = 'v0'; n = 4 if 'quad' in s else 1
    for j, card in enumerate(s.get('cards', [])):
        ins += ['-loop', '1', '-framerate', str(FPS), '-i', f'{P}/cards/{card["png"]}.png']
        a, b = card.get('in', 0.15), card.get('out', s['dur'] - 0.3)
        fc.append(f'[{n + j}]format=rgba,fade=t=in:st={a}:d=0.35:alpha=1,fade=t=out:st={b}:d=0.35:alpha=1[c{j}];'
                  f'[{last}][c{j}]overlay=shortest=1[o{j}]')
        last = f'o{j}'
    fc.append(f'[{last}]trim=duration={dur},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[out]')
    run([*ins, '-filter_complex', ';'.join(fc), '-map', '[out]', '-t', str(dur), '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', c])
    clips.append((c, dur))

# chain the clips with crossfades
ins = sum((['-i', c] for c, _ in clips), [])
fc, last, t = [], '0:v', clips[0][1]
for k in range(1, len(clips)):
    off = t - X
    fc.append(f'[{last}][{k}:v]xfade=transition=fade:duration={X}:offset={off:.3f}[x{k}]')
    last, t = f'x{k}', off + clips[k][1]
total = t
m = edit['music']
ins += ['-ss', str(edit.get('musicStart', 0)), '-i', m]
fade = edit.get('fade', 2.0)
fc.append(f'[{len(clips)}:a]atrim=duration={total:.3f},afade=t=in:d=0.4,afade=t=out:st={total - fade:.3f}:d={fade},loudnorm=I=-16:TP=-1.5[a]')
run([*ins, '-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-map', '[a]', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
     '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out])
print(f'{out}: {total:.2f} s, {len(clips)} clips')
