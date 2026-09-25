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

    python3 scripts/music/gen/sfx_merge.py --jobs sfx-ph-jobs.json --stage <dir>

PINE-HOLLOW-REMASTER PH-A2..A4: the same rule for another families file whose per-model sets sfx_build.py --stage wrote to
<dir>/moss/ and <dir>/sa3-medium/ (rankings in sfx-ph-<set>.json). Each family goes where its `into` says:
  best         merged INTO public/assets/sfx/best/ additively: that family's old files and provenance are replaced by the
               winner's; if neither new take ranks in the top 5 the family's round-2 files stay. Everything else in best/
               is untouched.
  pine-hollow  public/assets/sfx/pine-hollow/ (rebuilt): Pine Hollow's zoned beds (with their `zone` / `live`), barks and the
               sounds ready for events that do not exist yet. Not in Settings' SFX_SETS, so the loading bar does not
               download it for every shard; Pine Hollow reads it itself.
The decision rows land in scripts/music/gen/sfx-best.json next to round 2's (a `round: "pine-hollow"` and `into` on each).
Last, merge_ph runs scripts/music/gen/sfx_sprite.py on the rebuilt pine-hollow/ (without it a regeneration would un-pack
the set): every one-shot + bark goes into ONE audio sprite (the loading bar fetches one file, not 63), and with --raw
<sfx-raw-dir> (the lossless takes; the analysis venv) the sprite is cut from them and the mono-sourced beds ship mono.

    python3 scripts/music/gen/sfx_merge.py --jobs sfx-ph-jobs.json --stage <dir> --raw <sfx-raw-dir> --only fam,fam,...

A later round of a few families (sfx_build.py --only; the remaster's sound gaps): only those families are decided, copied
and given decision rows; pine-hollow/ is NOT rebuilt (every other family, bed and file stays as it is) and best/ is only
touched when one of them goes `into` it. The sprite is re-packed with the new takes after the old (sfx_sprite.py).
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
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default=None, help="another families file (sfx-ph-jobs.json); needs --stage")
    ap.add_argument("--stage", default=None, help="where sfx_build.py --stage wrote the per-model sets")
    ap.add_argument("--raw", default=None, help="with --jobs: the sfx raw dir (lossless takes) for sfx_sprite.py")
    ap.add_argument("--only", default="", help="with --jobs: decide and ship only these families (comma list); the rest stay")
    args = ap.parse_args()
    only = {f for f in args.only.split(",") if f}
    ph = args.jobs is not None
    if ph and args.stage is None:
        raise SystemExit("--jobs needs --stage")
    src_root = Path(args.stage) if ph else SFX
    fams = json.loads((HERE / (args.jobs or "sfx-jobs.json")).read_text())["families"]
    sets = {s: json.loads((src_root / s / "sfx.json").read_text()) for s in SOURCES}
    ranking = {s: json.loads((HERE / f"{'sfx-ph-' if ph else 'sfx-'}{s}.json").read_text())["families"] for s in SOURCES}

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

    if ph:
        merge_ph(fams, sets, ranking, src_root, entry, score, Path(args.raw) if args.raw else None, only)
        return

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


def merge_ph(fams: dict, sets: dict, ranking: dict, src_root: Path, entry, score, raw: Path | None = None,  # noqa: ANN001 - the closures above
             only: set[str] | None = None) -> None:
    best_dir, ph_dir = SFX / "best", SFX / "pine-hollow"
    ph_dir.mkdir(parents=True, exist_ok=True)
    best = json.loads((best_dir / "sfx.json").read_text())
    table_doc = json.loads((HERE / "sfx-best.json").read_text())
    table = table_doc["families"]
    if only:  # a later round: the set stays, these families are replaced in it
        man = json.loads((ph_dir / "sfx.json").read_text())
        for fam in only:
            kind = fams[fam]["kind"]
            sec, key = (man["oneshots"], fam) if kind == "oneshot" else (man["beds" if kind == "bed" else "hums"], fam.split("-", 1)[1])
            e = sec.pop(key, None)
            olds = [] if e is None else e["files"] if "files" in e else [e["file"]]
            man["provenance"] = [p for p in man["provenance"] if p["file"] not in olds]
            for f in olds:
                (ph_dir / f).unlink(missing_ok=True)  # a packed take has no file: the re-pack drops its clip
    else:
        for old in ph_dir.glob("*.m4a"):  # this folder holds only this function's output
            old.unlink()
        man = {"model": best["model"], "credit": best["credit"], "licence": best["licence"], "set": "pine-hollow",
               "beds": {}, "hums": {}, "oneshots": {}, "provenance": []}
    keeps, total = [], {"best": 0, "pine-hollow": 0}

    def section(m: dict, fam: str) -> tuple[dict, str]:
        kind = fams[fam]["kind"]
        return (m["oneshots"], fam) if kind == "oneshot" else (m["beds" if kind == "bed" else "hums"], fam.split("-", 1)[1])

    missing = []
    for fam, j in fams.items():
        if only and fam not in only:
            continue
        if any(fam not in ranking[s] for s in SOURCES):  # not rendered by both models yet: left as it is
            missing.append(fam)
            continue
        (rm, pm), (rs, ps) = score("moss", fam), score("sa3-medium", fam)
        win = "moss" if (rm, -pm) <= (rs, -ps) else "sa3-medium"
        rank = rm if win == "moss" else rs
        into = j.get("into", "pine-hollow")
        row = {"winner": win, "moss": {"rank": rm, "p": pm}, "sa3-medium": {"rank": rs, "p": ps}, "round": "pine-hollow", "into": into}
        e, files = entry(win, fam)
        if rank > SHIP_MAX_RANK or e is None:
            keeps.append(fam)
            row["winner"] = "synth" if fam not in table or into != "best" else "kept-round-2"
            if into == "best" and fam in table:
                row["kept"] = table[fam]  # the round-2 decision, whose files stay
            table[fam] = row
            continue
        target, m = (best_dir, best) if into == "best" else (ph_dir, man)
        sec, key = section(m, fam)
        if into == "best" and key in sec:  # replace the round-2 files of this family
            olds = sec[key]["files"] if "files" in sec[key] else [sec[key]["file"]]
            for f in olds:
                (best_dir / f).unlink(missing_ok=True)
            best["provenance"] = [p for p in best["provenance"] if p["file"] not in olds]
        for f in files:
            shutil.copy2(src_root / win / f, target / f)
            total[into] += (target / f).stat().st_size
            p = next(x for x in sets[win]["provenance"] if x["file"] == f)
            m["provenance"].append({**p, "source": SOURCES[win], "set_of_origin": win, "round": "pine-hollow"})
        e = dict(e)
        if fams[fam]["kind"] == "bed":
            e["zone"], e["live"] = j.get("zone"), bool(j.get("live"))
        sec[key] = e
        table[fam] = row
    new_keeps = [f for f in keeps if fams[f].get("into") != "best"]
    man["synth_keeps"] = [f for f in man.get("synth_keeps", []) if f not in only] + new_keeps if only else new_keeps
    best["synth_keeps"] = sorted(set(best.get("synth_keeps", [])) - {f for f in fams if table.get(f, {}).get("winner", "synth") not in ("synth", "kept-round-2")})
    if not only or any(fams[f].get("into") == "best" for f in only):
        (best_dir / "sfx.json").write_text(json.dumps(best, indent=2, ensure_ascii=False) + "\n")
    (ph_dir / "sfx.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n")
    table_doc["wins"] = {k: sum(1 for t in table.values() if t["winner"] == k) for k in ("moss", "sa3-medium", "synth", "kept-round-2")}
    (HERE / "sfx-best.json").write_text(json.dumps(table_doc, indent=2) + "\n")
    print(f"pine-hollow: best += {total['best'] / 1e6:.2f} MB, pine-hollow {total['pine-hollow'] / 1e6:.2f} MB, wins {table_doc['wins']}, not shipped {keeps}, not rendered yet {missing}")
    from sfx_sprite import run as pack  # the rebuilt set is one file per sound again: pack it (and, with --raw, its beds)

    pack(ph_dir, raw)


if __name__ == "__main__":
    main()
