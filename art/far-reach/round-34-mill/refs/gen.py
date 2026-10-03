"""Sky Reach top-10 row 6 (E410): the windmill set from mockups A and C (and proposal B): one object each on white (then
BiRefNet, Hunyuan3D-2). The tower and its cap are one model; the sails stay the code ones (they turn); the stone foot is
the rocky outcrop the tower stands on. The mill keeps its code collider (world/build.ts).

  python3 gen.py [names...]      # -> ref-<name>.png here
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
A = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-A-spawn-look.jpg')
C = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-C-hands-fan-painterly.jpg')
REFS = {'tower': A, 'tower-b': A, 'foot': C}
STYLE = ("Painterly-stylized game-asset concept matching the attached mockup (Genshin Impact / Studio Ghibli finish), rich stone "
         "detail, soft EVEN warm studio light, the WHOLE object in frame with a margin all round, on a PURE WHITE background "
         "(#FFFFFF), nothing else: no grass, no ground, no sky, no text, no watermark.")
PROMPTS = {
    'tower': ("Paint ONE 1024x1024 image of the windmill's TOWER AND CAP ONLY from the attached mockup, WITHOUT ITS SAILS: a tall round "
              "tapering tower mill of weathered WHITEWASHED RUBBLE STONE (irregular patched stone courses showing through flaking "
              "lime wash, grey rain streaks under the cap and the small windows, moss and grime at the foot), a mat of dark green IVY "
              "climbing the left side from the ground to half its height, a heavy arched planked wooden door at the foot in a "
              "dressed-stone frame, three small deep-set windows up the tower, a ring of weathered timber boards (the curb) under a "
              "DARK SLATE-SHINGLED ogee cap with a small iron finial, and only a short thick wooden WINDSHAFT stub with a round hub "
              "sticking out of the cap's front (NO sails, NO blades, NO stocks). The tower is about three times as tall as it is wide. "
              "Seen from the front three-quarter view at eye level, the door facing the viewer. " + STYLE),
    'tower-b': ("Paint ONE 1024x1024 image of a weathered stone TOWER MILL BODY like the one in the attached mockup, with NO sails at all: "
                "a tall round slightly tapering tower of whitewashed rough stone with uneven patched masonry and lime wash worn off "
                "in patches, dark rain streaks, ivy climbing from the foot on the left, a wooden door with iron straps at the foot, "
                "small windows, a boarded timber curb and a dark grey shingled dome-shaped cap with a finial, a stubby windshaft "
                "with a plain round hub at the front of the cap (no sail arms). About three times as tall as wide. Front three-quarter "
                "view at eye level. " + STYLE),
    'foot': ("Paint ONE 1024x1024 image of a SINGLE low rocky stone OUTCROP like the rock the windmill stands on in the attached "
             "mockup: a broad, low, irregular mound of weathered grey-gold rock slabs and boulders, cracked and lichen-patched, "
             "with grass tufts and a few small ferns in its cracks, its top a roughly FLAT round ledge (where a tower would stand, "
             "nothing standing on it), its sides broken into stepped rock faces. About four times as wide as it is tall. Seen from "
             "the front and slightly above (about 20 degrees), so the flat top and the rocky sides both show. " + STYLE),
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', REFS[name]], stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write((PROMPTS[name] + TASK).encode()); p.stdin.close()
        sid, t0, got = None, time.time(), None
        while time.time() - t0 < 900:
            time.sleep(5)
            if sid is None:
                m = re.search(r'session id:\s*([0-9a-f-]+)', open(logp).read()); sid = m.group(1) if m else None
            if sid:
                pngs = glob.glob(os.path.expanduser(f'~/.codex/generated_images/{sid}/*.png'))
                if pngs: time.sleep(3); got = pngs[0]; break
            if p.poll() is not None and sid is None: break
        if p.poll() is None: p.kill()
        if got: shutil.copy(got, out); return name, 'ok'
    return name, 'failed'


if __name__ == '__main__':
    names = sys.argv[1:] or list(PROMPTS)
    with ThreadPoolExecutor(len(names)) as ex:
        for n, st in ex.map(one, names): print(n, st, flush=True)
