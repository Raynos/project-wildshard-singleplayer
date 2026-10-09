#!/usr/bin/env python3
"""mkspec.py — write the scout specs (one per build + shard) from the progress-camera lists."""
import json, math, os
P = os.path.dirname(os.path.abspath(__file__))
PORT = {'d01': 4711, 'd08': 4712, 'd15': 4713, 'd22': 4714}

def fp(id, x, z, yaw, pitch=-4, eye=1.7, fov=60, dist=60):
    yr, pr = math.radians(yaw), math.radians(pitch)
    return {'id': id, 'fp': True, 'cam': [x, eye, z], 'at': [x - math.sin(yr) * dist, eye + math.tan(pr) * dist, z - math.cos(yr) * dist], 'fov': fov}

def god(id, pos, look, fov=55):
    return {'id': id, 'cam': pos, 'at': look, 'fov': fov}

SETS = {
  'pine-hollow': [fp('p1-spawn-n', 0, -236, 180, -2), fp('p2-cabin-porch', 0, -200, 180), fp('p3-pond', -10.31, -34.39, -74.83),
                  fp('p4-lookout', 41.23, 211.92, 112.87), fp('p5-lodge', -168.36, -108.99, 328.88),
                  god('p6-aerial-spawn', [0, 50, -260], [0, 0, -190]), god('p7-aerial', [0, 260, -380], [0, 0, 0])],
  'driftwood-isle': [fp('w1-pier', 0, -235, 180), fp('w2-hut', -30, -106, 180), fp('w3-lookout', 86.1, 82.45, 214.4),
                     fp('w4-shrine', -86.49, 92.26, 143.81), god('w5-aerial-spawn', [0, 60, -300], [0, 0, -200]),
                     god('w6-aerial', [0, 220, -380], [0, 0, 0])],
  'nine-dragon-stack': [fp('n1-square', 0.95, 7.5, -12.03), fp('n2-stair', 14, 6, -90), fp('n3-gate', -19.8, -25.4, -90),
                        fp('n4-well', -26, 13.6, -90), god('n5-aerial-spawn', [0, 175, 60], [0, 125, 0]),
                        god('n6-aerial', [80, 260, 160], [0, 100, 0])],
  'far-reach': [fp('f1-sunrest', 0, -9, 0), fp('f2-windmill', -8, -54, -49, 8), fp('f3-high-step', -3, -56, 41, 10),
                fp('f4-crown', 0, -175.5, 0, 6), god('f5-aerial-spawn', [0, 62, 41], [0, 30, -29]),
                god('f6-aerial', [0, 130, 90], [0, 30, -100])],
  'sunscar-dunes': [fp('s1-crest', 0, 70, 0, -6), fp('s2-caravan', -64, 38, 54.46, -6), fp('s3-waymark', 56.6, -40.4, -167.7, 9),
                    fp('s4-tower', 8.4, -73.0, 19, -12), god('s5-aerial-spawn', [0, 58, 125], [0, 13, 50]),
                    god('s6-aerial', [0, 250, 165], [0, 0, -40])],
}
JOBS = [('d01', 'pine-hollow'), ('d08', 'pine-hollow'), ('d08', 'driftwood-isle'), ('d15', 'pine-hollow'),
        ('d15', 'nine-dragon-stack'), ('d22', 'pine-hollow'), ('d22', 'far-reach'), ('d22', 'sunscar-dunes')]
for b, s in JOBS:
    q = 'nolock=1&skipintro=1&mute=1' if b == 'd01' else f'chunk={s}&mute=1&nolock=1&skipintro=1&weather=clear&perf=0&sw=0'
    spec = {'url': f'http://127.0.0.1:{PORT[b]}/?{q}', 'out': f'{P}/scout-{b}-{s}', 'views': SETS[s]}
    json.dump(spec, open(f'{P}/scout-{b}-{s}.json', 'w'), indent=1)
    print(f'scout-{b}-{s}.json')
