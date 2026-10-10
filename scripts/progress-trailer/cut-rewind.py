#!/usr/bin/env python3
"""cut-rewind.py — assemble the rewind (PROGRESS-TRAILER §2.2 0:46) from its four takes, one per build.

  python3 scripts/progress-trailer/cut-rewind.py <out.mp4> <take-dir day 1> <day 8> <day 15> <day 22> [--from=0.4] [--cuts=2,4,6]

Each take is the same input track (shots/rewind.mjs) filmed with the same `--ramp`, so sample i of every take is the same
simulation moment. The receipt's ramp and sub are replayed to know each sample's simulation time; the fire time comes from
the receipt's events. The cut from one build to the next lands where the bolt has flown the given distance (62 m/s, the
same in all four builds), so the bolt reads as one bolt. The last take carries the impact to its end. Writes a 60 fps
H.264 preview (the trailer's master goes through edit.mjs as frame dirs).
"""
import json, os, subprocess, sys, tempfile

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
out, takes = args[0], args[1:5]
START = float(opt.get('from', '0.4'))
CUTS = [float(x) for x in opt.get('cuts', '2,4,6').split(',')]
BOLT = 62.0


def sample_times(r):
    ramp, sub, speed = r.get('ramp'), r.get('sub', 1), r.get('speed', 1)
    def speed_at(t):
        if not ramp:
            return speed
        if t <= ramp[0][0]:
            return ramp[0][1]
        for (t0, s0), (t1, s1) in zip(ramp, ramp[1:]):
            if t <= t1:
                return s0 + (s1 - s0) * (t - t0) / (t1 - t0)
        return ramp[-1][1]
    times, t = [], 0.0
    while t < r['frames'] / 60 - 1e-9:
        times.append(t)
        t += speed_at(t) / (60 * sub)
    return times


receipts = [json.load(open(os.path.join(d, 'receipt.json'))) for d in takes]
fire = next(e['t'] for e in receipts[-1]['events'] if e['e'] == 'fire') - receipts[-1]['simStart']
bounds = [START] + [fire + c / BOLT for c in CUTS] + [float('inf')]
times = sample_times(receipts[-1])
tmp = tempfile.mkdtemp(prefix='rewind-')
n = 0
for k, d in enumerate(takes):
    for i, t in enumerate(times):
        if bounds[k] <= t < bounds[k + 1]:
            src = os.path.join(d, f'{i:06d}.jpg')
            if not os.path.exists(src):
                sys.exit(f'{src} missing (a --dry take?)')
            os.symlink(src, os.path.join(tmp, f'{n:06d}.jpg'))
            n += 1
    print(f'take {k + 1}: sim {bounds[k]:.3f}–{min(bounds[k + 1], times[-1]):.3f} s')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', os.path.join(tmp, '%06d.jpg'), '-vf', 'scale=1280:720',
                '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
for f in os.listdir(tmp):
    os.unlink(os.path.join(tmp, f))
os.rmdir(tmp)
print(f'{out}: {n} frames, {n / 60:.2f} s')
