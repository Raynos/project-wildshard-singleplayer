"""The four hero scenes' nine cameras each (E392; docs/design/LOOK-LOOP.md Step 1), written to cameras9.json.

  python3 cameras9.py            # -> cameras9.json (a list of views.mjs shots: FP poses and god cameras)

Anchors (P = where the player stands, f = the facing yaw, engine convention: yaw faces (-sin yaw, -cos yaw)):
  H1 spawn      the mockup camera (B-sky-reach / mockup A): Sunrest's north rim, facing the bridge and the windmill isle
  H2 windmill   the windmill isle's meadow, facing the mill
  H3 step       the high step, facing the storm crown along the crown bridge
  H4 crown      the arena's entrance, facing the dais and the stone arc (mockup D)
Shots per anchor (LOOK-LOOP order): 1 FP front, 2 FP left, 3 FP right, 4 FP back (eye at P, pitch -0.06 rad),
5 TOP (75 m above P, looking down, front = image up), 6 DIAG FRONT (45 m up, 55 m behind, looking 20 m ahead of P),
7 DIAG LEFT, 8 DIAG RIGHT (45 m up, 55 m to the side, looking at P), 9 DIAG BACK (45 m up, 55 m ahead, looking back at P).
All iPhone portrait (Jake: every screenshot iPhone portrait).
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ANCHORS = {
    'H1': {'p': (0, 30, -9), 'face': (0, -64)},
    'H2': {'p': (-8, 30, -54), 'face': (0, -70)},
    'H3': {'p': (-6, 44, -116), 'face': (0, -190)},
    'H4': {'p': (0, 44, -174), 'face': (0, -196)},
}
shots = []
for name, a in ANCHORS.items():
    px, py, pz = a['p']; fx, fz = a['face']
    dx, dz = fx - px, fz - pz; d = math.hypot(dx, dz); ux, uz = dx / d, dz / d   # forward
    yaw = math.atan2(-ux, -uz)   # degrees below; views.mjs takes degrees
    lx, lz = uz, -ux                                                           # left of forward (yaw + 90)
    deg = math.degrees(yaw)
    for i, (label, dy) in enumerate([('front', 0), ('left', 90), ('right', -90), ('back', 180)]):
        shots.append({'id': f'{name}-{i + 1}-{label}', 'x': px, 'y': py, 'z': pz, 'yaw': round(deg + dy, 2), 'pitch': -3.4})
    eye = py + 1.7
    shots.append({'id': f'{name}-5-top', 'god': {'pos': [px + ux * 0.01, eye + 75, pz + uz * 0.01], 'look': [px, eye, pz], 'fov': 72}})
    shots.append({'id': f'{name}-6-diag-front', 'god': {'pos': [px - ux * 55, eye + 45, pz - uz * 55], 'look': [px + ux * 20, eye, pz + uz * 20], 'fov': 72}})
    shots.append({'id': f'{name}-7-diag-left', 'god': {'pos': [px + lx * 55, eye + 45, pz + lz * 55], 'look': [px, eye, pz], 'fov': 72}})
    shots.append({'id': f'{name}-8-diag-right', 'god': {'pos': [px - lx * 55, eye + 45, pz - lz * 55], 'look': [px, eye, pz], 'fov': 72}})
    shots.append({'id': f'{name}-9-diag-back', 'god': {'pos': [px + ux * 55, eye + 45, pz + uz * 55], 'look': [px, eye, pz], 'fov': 72}})
json.dump(shots, open(os.path.join(HERE, 'cameras9.json'), 'w'), indent=1)
print(len(shots), 'shots')
