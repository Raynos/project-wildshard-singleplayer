"""Sky Reach top-10 row 3 (E407/E392): references for the war fan and the layered glove, codex image_gen.

  python3 gen.py [names...]      # -> <name>.png here (then JPEG)

  glove  mockup C/A's fan hand rebuilt as a LAYERED glove: segmented leather plates over the back of the hand, a riveted
         bracer of overlapping lames with buckled straps, a bound linen sleeve; on white, for Hunyuan3D-2
  leaf   the fan's silk leaf as a flat, unwrapped texture strip (u = guard to guard, v = inner edge to rim): aged teal
         silk, large pale cloud swirls, a dark lacquer inner band and a worn gilt rim, for weapons/fanModel.ts
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
MOCK = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-C-hands-fan-painterly.jpg')
STYLE = ("Painterly-stylized game-asset concept like the attached mockup (Genshin Impact / Studio Ghibli finish): soft visible brush "
         "work, rich surface detail, clean readable shapes. Soft EVEN studio light from the front-left, gentle shading, no cast shadow, "
         "no strong rim light. The whole object fully in frame with a margin, on a PURE WHITE background (#FFFFFF), nothing else in "
         "the image: no ground, no body, no scenery, no text, no watermark.")
GLOVE = ("a SINGLE disembodied RIGHT forearm and hand, the first-person weapon hand from the lower right of the attached mockup: the "
         "hand closed in a firm fist round a short straight vertical handle (a 12 cm dark-wood fan grip wrapped in dark red cord, a "
         "bronze cap on top, its ends sticking out above and below the fist; NO fan, only the handle). The hand wears a LAYERED "
         "dark-brown LEATHER GAUNTLET: fingerless, the bare fingertips curled over the handle, the thumb laid over the index and "
         "middle fingers; three overlapping curved leather PLATES riveted over the back of the hand and a small plate on each "
         "knuckle, visible stitching. Over the wrist and forearm a thick BRACER of four OVERLAPPING leather-and-bronze LAMES (like "
         "samurai kote), each edged with bronze and riveted, held by two buckled straps, an embossed cloud swirl on the top lame. "
         "Behind the bracer the forearm is in a loose cream-white LINEN SLEEVE wrapped and bound with thin brown cords, ending in a "
         "clean flat cut a little below the elbow. The forearm is straight and LEVEL, running from the fist at the LEFT of the image "
         "to the cut sleeve at the RIGHT, seen from the thumb side in a three-quarter view slightly from above. ")
LEAF = ("Paint ONE 2048x1024 flat TEXTURE (a straight, unwrapped rectangular strip seen exactly face-on, filling the whole canvas edge "
        "to edge, NO perspective, NO fan shape, NO background) of the silk leaf of the war fan in the attached mockup: aged, "
        "slightly faded TEAL silk (#2f7f80 to #3f8d8c) with a fine woven texture and subtle creases, a row of LARGE pale sea-green "
        "and cream CLOUD SWIRLS (Chinese auspicious clouds, xiangyun) across the middle band, a few smaller clouds above and below, "
        "a NARROW worn GILT border along the top edge, and along the bottom edge a 12 % tall band of darker teal with a thin gold "
        "line. Painterly-stylized game texture (Genshin Impact finish), soft brush work, even lighting, no shadows, no text, no "
        "watermark, no frame. The pattern must tile seamlessly left to right.")
PROMPTS = {
    'glove': "Paint ONE 1024x1024 image of " + GLOVE + STYLE,
    'leaf': LEAF,
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', MOCK], stdin=subprocess.PIPE, stdout=log, stderr=log)
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
