#!/usr/bin/env python3
"""mkshots.py — the final camera moves (capture.mjs specs), one per shot."""
import json, math, os, sys
P = os.path.dirname(os.path.abspath(__file__))
PORT = {'d01': 4711, 'd08': 4712, 'd15': 4713, 'd22': 4714}

def look(x, z, yaw, pitch, eye=1.7, dist=60):
    yr, pr = math.radians(yaw), math.radians(pitch)
    return [x - math.sin(yr) * dist, eye + math.tan(pr) * dist, z - math.cos(yr) * dist]

def walk(x, z, yaw, pitch, metres, eye=1.7):
    """a first-person push of `metres` along the view's heading"""
    yr = math.radians(yaw); dx, dz = -math.sin(yr) * metres, -math.cos(yr) * metres
    return {'from': {'cam': [x, eye, z], 'at': look(x, z, yaw, pitch, eye)},
            'to': {'cam': [x + dx, eye, z + dz], 'at': look(x + dx, z + dz, yaw, pitch, eye)}, 'fp': True}

def fly(c0, a0, c1, a1):
    return {'from': {'cam': c0, 'at': a0}, 'to': {'cam': c1, 'at': a1}, 'fp': False}

SHOTS = {
    # the same spot on every build: Pine Hollow's south trail, walking north
    'pine-d01': ('d01', 'pine-hollow', walk(0, -236, 180, -2, 9), 3.4),
    'pine-d08': ('d08', 'pine-hollow', walk(0, -236, 180, -2, 9), 3.4),
    'pine-d15': ('d15', 'pine-hollow', walk(0, -236, 180, -2, 9), 3.4),
    'pine-d22': ('d22', 'pine-hollow', walk(0, -236, 180, -2, 9), 3.4),
    'drift-d08': ('d08', 'driftwood-isle', fly([0, 210, -400], [0, 0, -40], [0, 110, -320], [0, 0, -120]), 3.6),
    'nalati-d08': ('d08', 'nalati-grasslands', fly([0, 72, 335], [0, 20, 60], [0, 58, 285], [0, 22, 30]), 3.6),
    'sky-d22': ('d22', 'far-reach', fly([0, 74, 62], [0, 30, -29], [0, 58, 32], [0, 30, -45]), 3.6),
    'dunes-d22': ('d22', 'sunscar-dunes', walk(-64, 38, 54.46, -6, 4), 3.6),
    'nine-d15': ('d15', 'nine-dragon-stack', walk(0.95, 7.5, -12.03, -2, 5), 3.6),
}
def write(name):
    b, s, move, secs = SHOTS[name]
    q = 'nolock=1&skipintro=1&mute=1' if b == 'd01' else f'chunk={s}&mute=1&nolock=1&skipintro=1&weather=clear&perf=0&sw=0'
    move = {**move, 'fov': move.get('fov', 60)}
    spec = {'url': f'http://127.0.0.1:{PORT[b]}/?{q}', 'out': f'{P}/shot-{name}', 'fps': 30, 'seconds': secs,
            'loadWaitSec': 2, 'move': move, 'hideDom': True, 'warmSec': 2}
    json.dump(spec, open(f'{P}/shot-{name}.json', 'w'), indent=1)
    return f'shot-{name}.json'

if __name__ == '__main__':
    for n in (sys.argv[1:] or SHOTS):
        print(write(n))
