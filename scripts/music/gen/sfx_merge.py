"""The final sound set (AGENTS.md "Audio engines", the user 2026-09-23): every sound effect is generated with
MOSS-SoundEffect v2 and Stable Audio 3 Medium, and the better take of the two ships, in ONE merged set.

    python3 scripts/music/gen/sfx_merge.py

No generation and no re-encoding: reads the two shipped sets (public/assets/sfx/moss/, public/assets/sfx/sa3-medium/,
built by sfx_build.py) and their CLAP rankings (scripts/music/gen/sfx-moss.json, sfx-sa3-medium.json), and per family:
  the winner is the lower CLAP rank of the two models' best takes (ties -> the higher CLAP p). A family whose winner
  ranks worse than SHIP_MAX_RANK (5) is in neither set, so it stays in `synth_keeps` and the synth plays it.
The winner's files (already content-addressed, loop points already measured on the decoded file) are copied as they are
into public/assets/sfx/best/, with its sfx.json entry; the provenance keeps the per-file `source` model.
Writes public/assets/sfx/best/sfx.json and scripts/music/gen/sfx-best.json (the per-family decision table).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SFX = REPO / "public/assets/sfx"
SHIP_MAX_RANK = 5
SOURCES = {"moss": "MOSS-SoundEffect v2.0 (OpenMOSS-Team/MOSS-SoundEffect-v2.0, Apache-2.0)",
           "sa3-medium": "Stable Audio 3 Medium (stabilityai/stable-audio-3-medium, Stability AI Community License)"}


def main() -> None:
    fams = json.loads((HERE / "sfx-jobs.json").read_text())["families"]
    sets = {s: json.loads((SFX / s / "sfx.json").read_text()) for s in SOURCES}
    ranking = {s: json.loads((HERE / f"sfx-{s}.json").read_text())["families"] for s in SOURCES}

    def entry(s: str, fam: str) -> tuple[dict | None, list[str]]:
        m = sets[s]
        kind = fams[fam]["kind"]
        if kind == "oneshot":
            e = m["oneshots"].get(fam)
            return e, (e["files"] if e else [])
        key = fam.split("-", 1)[1]
        e = m["beds" if kind == "bed" else "hums"].get(key)
        return e, ([e["file"]] if e else [])

    def score(s: str, fam: str) -> tuple[int, float]:
        _, files = entry(s, fam)
        prov = {p["file"]: p for p in sets[s]["provenance"]}
        if files:  # the take that set actually ships
            p = prov[files[0]]
            return int(p["clap_rank"]), float(p["clap_p"])
        best = ranking[s][fam][0]  # not shipped by that set: its best take's rank
        return int(best["rank"]), float(best["p"])

    dest = SFX / "best"
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.m4a"):  # this folder holds only this script's output
        old.unlink()
    man: dict = {"model": "MOSS-SoundEffect v2 + Stable Audio 3 Medium",
                 "credit": "Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 Medium — Powered by Stability AI",
                 "licence": "Per file (see provenance.source): MOSS-SoundEffect v2.0 is Apache-2.0; Stable Audio 3 Medium is the Stability AI "
                            "Community License (free below USD 1M revenue, register with Stability AI for commercial use, show 'Powered by Stability AI').",
                 "beds": {}, "hums": {}, "oneshots": {}, "provenance": []}
    table, keeps, total = {}, [], 0
    for fam in fams:
        (rm, pm), (rs, ps) = score("moss", fam), score("sa3-medium", fam)
        win = "moss" if (rm, -pm) <= (rs, -ps) else "sa3-medium"
        rank = rm if win == "moss" else rs
        table[fam] = {"winner": win, "moss": {"rank": rm, "p": pm}, "sa3-medium": {"rank": rs, "p": ps}}
        e, files = entry(win, fam)
        if rank > SHIP_MAX_RANK or e is None:
            keeps.append(fam)
            table[fam]["winner"] = "synth"
            continue
        for f in files:
            shutil.copy2(SFX / win / f, dest / f)
            total += (dest / f).stat().st_size
            p = next(x for x in sets[win]["provenance"] if x["file"] == f)
            man["provenance"].append({**p, "source": SOURCES[win], "set_of_origin": win})
        kind = fams[fam]["kind"]
        if kind == "oneshot":
            man["oneshots"][fam] = e
        else:
            man["beds" if kind == "bed" else "hums"][fam.split("-", 1)[1]] = e
    man["synth_keeps"] = keeps
    (dest / "sfx.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n")
    wins = {k: sum(1 for t in table.values() if t["winner"] == k) for k in ("moss", "sa3-medium", "synth")}
    (HERE / "sfx-best.json").write_text(json.dumps({"rule": "lower CLAP rank wins, ties to the higher p; ships only in the top 5",
                                                    "wins": wins, "families": table}, indent=2) + "\n")
    print(f"best: {total / 1e6:.2f} MB, wins {wins}, synth keeps {keeps}")


if __name__ == "__main__":
    main()
