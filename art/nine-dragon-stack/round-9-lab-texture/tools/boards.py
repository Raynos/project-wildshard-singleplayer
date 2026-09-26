#!/usr/bin/env python3
"""boards.py <scratch tex dir> <out dir> — the round's boards from the loop captures (cap1 … cap14), the codex edits and
the round-8 target crops: loop-<nn>.jpg (lab crops over the same target crops), ab.jpg (paint off | on per camera),
final.jpg (final frames | codex edits of them | the round-8 targets, then the surface crops)."""
import os, subprocess, sys

T, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
BOARD = os.path.join(HERE, 'board.py')
TG = os.path.join(HERE, '../../round-8-look-loop-1')

LOOPS = [
    (1, 'cap1', 'first light: v1 codex swatches (photo-ish granite, concrete, stone, frieze, tiles, lacquer, wood, bills)'),
    (2, 'cap2', 'flag / concrete big blotches flattened (sigma 5 %), cameras fixed'),
    (3, 'cap3', 'wet stone darkening + sheen, bills take the wall grime, shopfront spill as the clean room'),
    (4, 'cap4', 'rain rivulets on wet stone, wet 0.45, lab shop spill 0.12'),
    (5, 'cap5', 'brush-dab boost (unsharp 2-12 px), slate paint ink, reflections break on the dabs'),
    (6, 'cap6', 'v2 layers: codex dab swatches painted from codex edits of our own frames; whole-face frieze'),
    (7, 'cap7', 'stronger reflection dapple'),
    (8, 'cap8', 'flag blotches flattened, concrete 0.8, dapple mean 1'),
    (9, 'cap9', 'the sky sheen gathers in the wet dabs'),
    (10, 'cap10', 'a painted wet floor keeps a floor of sheen seen from above'),
    (11, 'cap11', 'the facade grammar walls (shell program painted: cells, parapets, far faces)'),
    (12, 'cap12', 'concrete contrast 1.3, facade x1.1'),
    (13, 'cap13', 'every concrete-ish facade surface painted (modules, slabs, AC, slats, pipes)'),
    (14, 'cap14', 'FINAL: concrete 1.1 x0.9'),
]
LAB = [('corner', '0,0.55,0.6,1', 'flags'), ('panel', '0.1,0.33,0.9,0.66', 'panel'), ('down', '0,0.3,1,0.75', 'stone+flags'),
       ('tower', '0.4,0.15,0.95,0.55', 'tower wall'), ('shop', '0.3,0.3,1,0.7', 'shopfront'), ('gate', '0.2,0.25,0.9,0.85', 'lacquer')]
TGT = [(f'{TG}/target-1.jpg@0,0.6,0.62,1', 'target-1'), (f'{TG}/target-2.jpg@0,0.7,1,1', 'target-2'),
       (f'{TG}/target-6.jpg@0,0.63,1,0.85', 'target-6'), (f'{TG}/target-3.jpg@0.59,0.21,1,0.5', 'target-3'),
       (f'{TG}/target-3.jpg@0.6,0.5,1,0.7', 'target-3'), (f'{TG}/target-1.jpg@0.3,0.36,0.8,0.62', 'target-1')]


def run(args):
    subprocess.run(['python3', BOARD, *args], check=True, stdout=subprocess.DEVNULL)


for n, cap, what in LOOPS:
    row1 = [f'{T}/{cap}/{c}.jpg@{b}={lbl}' for c, b, lbl in LAB if os.path.exists(f'{T}/{cap}/{c}.jpg')]
    row2 = [f'{p}={lbl}' for p, lbl in TGT]
    run([f'{OUT}/loop-{n:02d}.jpg', f'loop {n}: {what} | top: lab crops, bottom: round-8 target crops', *row1, '//', *row2, '--h=300', '--q=80'])

cams = ['corner', 'panel', 'down', 'shop', 'gate', 'roof', 'tower', 'far']
row1 = [f'{T}/cap14/{c}-off.jpg={c} off' for c in cams[:4]] + ['//'] + [f'{T}/cap14/{c}.jpg={c} paint' for c in cams[:4]]
row2 = [f'{T}/cap14/{c}-off.jpg={c} off' for c in cams[4:]] + ['//'] + [f'{T}/cap14/{c}.jpg={c} paint' for c in cams[4:]]
run([f'{OUT}/ab-1.jpg', 'A/B, final: the round-8 flat washes (paint off) over the painted surfaces (paint on)', *row1, '--h=560', '--q=80'])
run([f'{OUT}/ab-2.jpg', 'A/B, final: paint off over paint on', *row2, '--h=560', '--q=80'])

E1, E2 = f'{T}/edits', f'{T}/edits2'
run([f'{OUT}/final.jpg', 'P5 texture, final: lab frame | codex edit of that frame | round-8 target — then surface crops (lab | edit | target)',
     f'{T}/cap14/corner.jpg=lab', f'{E2}/edit-corner.png=codex edit', f'{TG}/target-1.jpg=target-1',
     f'{T}/cap14/tower.jpg=lab', f'{E2}/edit-tower.png=codex edit', f'{TG}/target-3.jpg=target-3', '//420',
     f'{T}/cap14/corner.jpg@0,0.62,0.5,0.9=lab flags', f'{E2}/edit-corner.png@0,0.62,0.5,0.9=edit', f'{TG}/target-1.jpg@0.3,0.62,0.8,0.9=target-1',
     f'{T}/cap14/panel.jpg@0.1,0.36,0.9,0.62=lab panel', f'{E2}/edit-panel.png@0.1,0.36,0.9,0.62=edit', f'{TG}/target-2.jpg@0,0.7,1,0.93=target-2', '//420',
     f'{T}/cap14/down.jpg@0,0.3,1,0.75=lab stone', f'{E1}/edit-down.png@0,0.3,1,0.75=edit', f'{TG}/target-6.jpg@0,0.63,1,0.85=target-6',
     f'{T}/cap14/tower.jpg@0.4,0.15,0.95,0.55=lab wall', f'{E2}/edit-tower.png@0.4,0.15,0.95,0.55=edit', f'{TG}/target-3.jpg@0.59,0.21,1,0.5=target-3',
     '--h=860', '--q=82'])
print('boards ->', OUT)
