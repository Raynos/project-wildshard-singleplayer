"""Sky Reach top-10 row 10 (E410 row 8): the keeper set from mockup B, one object each on white (then BiRefNet, Hunyuan3D-2).

  python3 gen.py [names...]      # -> ref-<name>.png here (then JPEG)

  keeper   the bridge-keeper in a neutral rig pose: arms off the body, both hands open, the staff planted in his left hand
           (no lantern on it: mockup B hangs the lantern from the lectern), coat / scarf / satchel as separate volumes
  lectern  the carved wooden lectern on its box plinth, its reading board empty (the code book sits on it), an iron arm
  lantern  the iron-and-brass lantern that hangs from the lectern's arm
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
B = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-B-quest-start-painterly.jpg')
REFS = {'keeper': B, 'keeper-b': B, 'lectern': B, 'lantern': B}
STYLE = ("Painterly-stylized game-asset concept like the attached mockup (Genshin Impact / Studio Ghibli finish): soft visible brush "
         "work, rich surface detail, clean readable shapes. Soft EVEN studio light from the front-left, gentle shading, no cast shadow "
         "on the ground, no strong rim light. The whole object fully in frame with a margin, on a PURE WHITE background (#FFFFFF), "
         "nothing else in the image: no ground, no scenery, no text, no watermark.")
KEEPER = ("Paint ONE 1024x1024 image of a SINGLE CHARACTER, full body head to boots, standing upright, seen from the FRONT (turned "
          "only about 15 degrees to his left): the old bridge-keeper from the attached mockup. A kind, readable old face with clear "
          "eyes, bushy white eyebrows, a ruddy nose and a full white beard to mid-chest; a wide-brimmed slate-blue wizard hat with a "
          "soft crown and a leather band. LAYERED CLOTHES with clear separate volumes: a long heavy deep-blue travelling coat to his "
          "ankles with faint gold embroidery at the hem and cuffs, open at the front over a cream undertunic; a thick rust-brown wool "
          "scarf wound twice round his neck, one fringed end hanging down his chest and the other thrown back over his shoulder; a "
          "brown leather strap across his chest to a bulging leather satchel on his left hip; a belt; brown boots. ")
POSE_A = ("NEUTRAL RIG POSE: BOTH ARMS held clearly AWAY from his body, angled down and out about 30 degrees from his sides, with a "
          "wide clear gap of white between each arm and the coat all the way from armpit to hand; BOTH HANDS OPEN with the fingers "
          "spread and visible, palms facing forward. A tall gnarled wooden staff stands planted on the ground at his left side, "
          "its top just above his shoulder, his open left hand resting against it; NOTHING hangs from the staff. Feet apart. ")
POSE_B = ("NEUTRAL RIG POSE like a T-pose relaxed down: his RIGHT arm held out and down well away from the coat (about 35 degrees "
          "from his side, a wide white gap under it), the right hand OPEN, fingers spread, palm forward; his LEFT hand grips a tall "
          "gnarled wooden staff planted on the ground a little out from his side, a gap between the staff and the coat, NOTHING "
          "hanging from the staff. Feet apart. ")
PROMPTS = {
    'keeper': KEEPER + POSE_A + STYLE,
    'keeper-b': KEEPER + POSE_B + STYLE,
    'lectern': ("Paint ONE 1024x1024 image of a SINGLE carved wooden lectern like the one beside the keeper in the attached mockup, seen "
                "from a front three-quarter view slightly from above: a low plinth of two stacked heavy weathered planks bound with iron "
                "straps, a stout carved post rising from it (turned and carved with rings and a leaf-scroll band, old warm-brown wood "
                "with worn edges), and on top a slanted reading desk with a raised lip at its low front edge; the desk is EMPTY (no "
                "book). From one side of the post, two thirds of the way up, a curved wrought-iron arm reaches out sideways with a "
                "small hook at its tip; nothing hangs on the hook. About 1.1 m tall. " + STYLE),
    'lantern': ("Paint ONE 1024x1024 image of a SINGLE old hanging lantern like the one hanging from the lectern in the attached mockup, "
                "seen from the front, slightly from above: a dark iron frame with a peaked roof cap and a ring handle on top, four warm "
                "glass panes glowing amber-gold from a candle flame inside, a brass base. Taller than it is wide. " + STYLE),
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
