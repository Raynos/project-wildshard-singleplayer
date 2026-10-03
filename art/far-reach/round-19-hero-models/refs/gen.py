"""Sky Reach's hero-model references (E392/E399): codex image_gen, one object each on white, run in parallel.

  python3 gen.py [names...]      # -> ref-<name>.png here (then JPEG); Hunyuan3D-2 turns each into a textured model

  keeper  the bridge-keeper wizard of mockup B (round-18-council-mockups), standing, his right arm free for the wave rig
  roc     the Storm Roc of mockup D (round-11-review), a great eagle gliding with its wings spread flat (first try: Hunyuan
          stood its wings up and laid its tail flat)
  rocbelow  the same eagle seen from straight below, in one plane (the one that ships: pitched to fly, its painted side down)
  post    a rope-bridge anchor post of mockup A (round-11-review), weathered timber wrapped in thick rope
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
REFS = {
    'keeper': os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-B-quest-start-painterly.jpg'),
    'roc': os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg'),
    'rocbelow': os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg'),
    'post': os.path.join(REPO, 'art/far-reach/round-11-review/mockup-A-spawn-look.jpg'),
}
STYLE = ("Painterly-stylized game-asset concept like the attached mockup (Genshin Impact / Studio Ghibli finish): soft visible brush "
         "work, rich surface detail, clean readable shapes. Soft EVEN studio light from the front-left, gentle shading, no cast shadow "
         "on the ground, no strong rim light. The whole object fully in frame with a margin, on a PURE WHITE background (#FFFFFF), "
         "nothing else in the image: no ground, no scenery, no text, no watermark.")
PROMPTS = {
    'keeper': ("Paint ONE 1024x1024 image of a SINGLE CHARACTER, full body head to boots, standing upright, seen from a front "
               "three-quarter view (turned about 25 degrees to his left): the old bridge-keeper wizard from the attached mockup. A tall "
               "wide-brimmed slate-blue wizard hat with a soft crown, a kind weathered face, a long flowing white beard to mid-chest, a "
               "long flowing deep blue coat to his ankles with faint gold embroidery at the hem and cuffs, open over a cream undertunic, "
               "a thick rust-orange wool scarf wound round his neck with one end hanging down his front, a brown leather belt with a "
               "satchel on his hip, brown boots. His LEFT hand grips a tall gnarled wooden staff planted on the ground beside him, a "
               "small brass lantern hanging from a hook near the staff's top. His RIGHT arm hangs relaxed at his side held a little "
               "away from his body (a clear gap between the arm and the coat), the hand open. Feet slightly apart. " + STYLE),
    'roc': ("Paint ONE 1024x1024 image of a SINGLE giant eagle (the Storm Roc of the attached mockup) GLIDING with both wings spread "
            "FULLY OUT FLAT AND LEVEL to the sides (a straight horizontal span, wing tips fingered), seen from the FRONT three-quarter "
            "and slightly ABOVE so the top of both wings, the head and the chest all show. Dark chocolate-brown wings with paler "
            "cream-tan barred flight feathers and dark tips, a cream-white head and breast, a hooked golden-yellow beak, fierce amber "
            "eyes, a fanned brown tail with pale bars, golden talons tucked under the body. Symmetrical pose, the whole wingspan in frame. "
            + STYLE),
    'rocbelow': ("Paint ONE 1024x1024 image of a SINGLE giant eagle (the Storm Roc of the attached mockup) seen from DIRECTLY BELOW, "
                 "as if the viewer lies on the ground looking straight up at it: both wings spread FULLY OUT FLAT, perfectly symmetrical, "
                 "the whole wingspan level across the image, wing tips fingered; the head at the TOP of the image, the fanned tail at the "
                 "BOTTOM, everything in ONE flat plane like a specimen. The underside: dark chocolate-brown underwings with pale "
                 "cream-tan barred flight feathers and dark tips, a cream-white breast with faint brown chevrons, a fanned brown tail with "
                 "pale bars, golden talons tucked flat under the belly, the cream-white head and hooked golden-yellow beak foreshortened "
                 "at the top. " + STYLE),
    'post': ("Paint ONE 1024x1024 image of a SINGLE rope-bridge anchor post, seen from a front three-quarter view slightly from above: "
             "a thick square timber post about four times as tall as it is wide, silver-grey-brown weathered wood with deep grain, "
             "cracks and a chamfered flat cap, wrapped near its top third in many thick tight coils of tan hemp rope with a knotted rope "
             "end hanging down one side, iron bands and a few big nail heads, standing on a low footing of stacked grey stones with a "
             "little moss. Straight and upright, nothing attached to it. " + STYLE),
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
