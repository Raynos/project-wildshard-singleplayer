"""Sky Reach's painted textures (E392, toward the mockups): codex image_gen, one image each, run in parallel.

  python3 gen.py [names...]      # -> <name>.png here; then pack.py makes the shipped files

  clouds  a 4x2 atlas of painted golden-hour cumulus puffs on pure black (alpha comes from the brightness)
  rock    a seamless tileable painted cliff rock: grey-brown stone, faint warm strata, green moss streaks
  meadow  a seamless tileable painted meadow ground seen from above: grass, golden patches, tiny daisies
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
REF = os.path.join(REPO, 'art/far-reach/round-1-proposals/B-sky-reach.jpg')
STYLE = ("Painterly-stylized like the attached mockup (Studio Ghibli / Genshin Impact background art): soft visible brush work, "
         "rich detail, warm golden-hour light from the upper left.")
PROMPTS = {
    'stormeye': ("Paint ONE 1024x1024 image seen looking STRAIGHT UP from below into a giant STORM VORTEX overhead (E399, the crown "
                 "arena's sky in mockup D): a spiral of dark, heavy storm cloud filling the whole square, its centre exactly in the "
                 "middle, four curved spiral arms of churning slate-grey and bruised violet cloud winding inward toward a glowing "
                 "pale eye (about 10% of the image wide) at the exact centre lit from within by faint lightning; the arms' undersides "
                 "dark slate-blue and violet, their edges and rims catching warm gold and peach light from the low sun on the lower-left "
                 "side; one or two thin violet-white lightning forks inside the arms; toward the corners the spiral loosens into "
                 "ordinary dark storm cloud. No ground, no islands, no birds, no sun disc, no horizon, no text. " + STYLE),
    'maelstrom': ("Paint ONE 1024x1024 image seen STRAIGHT DOWN from high above: a giant circular MAELSTROM of cumulus cloud, a "
                  "spiral vortex filling the whole square, its centre exactly in the middle of the image, three to four curved "
                  "spiral arms of thick billowing cumulus winding inward clockwise toward a dark lavender-violet eye (a clear dark "
                  "well, about 8% of the image wide) at the exact centre; the arms' crests lit warm cream and peach-gold from the "
                  "upper left, deep lavender and blue-violet shadow in the troughs between the arms; toward the image corners the "
                  "spiral loosens into ordinary dense cumulus. No islands, no land, no sun, no horizon, no text. " + STYLE),
    'cloudsea': ("Paint ONE 1024x1024 SEAMLESS TILEABLE texture (it must tile with no visible seam on all four sides), seen STRAIGHT "
                 "DOWN from far above: a dense, unbroken sea of billowing cumulus cloud tops, packed edge to edge with no gaps or sky "
                 "showing through, soft round cauliflower billows of many sizes, their sunlit tops warm cream-white and peach-gold "
                 "(light from the upper left), the deep folds and hollows between them soft lavender and blue-violet shadow, a few "
                 "wisps. Even overall exposure, no single big shadow, no vignette, no horizon, no sun, no islands. " + STYLE + " No text."),
    'branches': ("Paint ONE 1024x1024 image: a sprite sheet of 4 separate conifer (pine / fir) BRANCH sprites in a 2 x 2 grid, each "
                 "branch filling its own square cell, NOT touching the cell edges or each other, on a FLAT PURE MAGENTA background "
                 "(#FF00FF everywhere outside the branches, no gradient, no shadow on it). Each branch: seen from above-side, a "
                 "drooping fir bough growing from the LEFT edge of its cell toward the right, a brown twig with dense layered clusters "
                 "of dark green needles, lighter yellow-green sunlit needle tips on top, deep blue-green in the shade, soft painterly "
                 "detail like the attached mockup's pines. No magenta inside the branches. " + STYLE + " No text, no grid lines."),
    'clouds': ("Paint ONE 1536x1024 image: a sprite atlas of 8 separate fluffy cumulus cloud puffs arranged in a 4 x 2 grid (4 across, "
               "2 down), each puff centred in its own cell and NOT touching the cell edges or each other, on a PURE BLACK background "
               "(#000000 everywhere outside the clouds). Each puff: a rounded billowing cauliflower cumulus, bright warm cream-white and "
               "peach-gold on its sunlit top and left, soft lavender-grey shadow in its lower belly, soft feathery edges fading into the "
               "black. Vary their shapes: some wide and flat, some tall, some clusters of small billows. " + STYLE + " No ground, no sky "
               "colour, no text, no grid lines."),
    'rock': ("Paint ONE 1024x1024 SEAMLESS TILEABLE texture (it must tile with no visible seam on all four sides), seen straight on: a "
             "craggy cliff face of grey-brown stone with faint horizontal warm sandstone strata, cracks and chiselled facets, green moss "
             "streaks and small hanging roots running down, lichen patches. Even lighting with gentle soft shading only (it is a material, "
             "not a scene): no horizon, no sky, no single big shadow, no vignette. " + STYLE + " No text."),
    'meadow': ("Paint ONE 1024x1024 SEAMLESS TILEABLE texture (it must tile with no visible seam on all four sides), seen straight from "
               "above: a lush meadow floor, dense green grass with golden-green sunlit patches, tiny white and yellow daisies scattered, a "
               "few small bare earth specks. Even top-down lighting, no shadows from objects, no horizon, no vignette, no large features. "
               + STYLE + " No text."),
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for attempt in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', REF], stdin=subprocess.PIPE, stdout=log, stderr=log)
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
        if got:
            import shutil; shutil.copy(got, out); return name, 'ok'
    return name, 'failed'


if __name__ == '__main__':
    names = sys.argv[1:] or list(PROMPTS)
    with ThreadPoolExecutor(len(names)) as ex:
        for n, st in ex.map(one, names): print(n, st, flush=True)
