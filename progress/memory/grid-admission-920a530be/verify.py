import json
from pathlib import Path

report = json.loads(Path(__file__).with_name("report.json").read_text())
assert [r["layout"] for r in report["results"]] == ["developer", "shipped"]
parts = {"asphalt", "curtain", "deck", "junctions", "signs", "void"}
for result in report["results"]:
    assert result["admitted"] and not result.get("failure")
    assert result["witness"]["build"] == report["version"]["build"]
    assert not result["errors"] and not result["driveFailures"]
    drive = result["drive"]
    assert drive["complete"] and not drive["timedOut"] and not drive["stuck"]
    assert drive["crossingDelta"] == 4 and not drive["issues"]
    assert drive["transitions"] == [
        {"from": "driftwood-isle", "to": None}, {"from": None, "to": "template-4"},
        {"from": "template-4", "to": None}, {"from": None, "to": "driftwood-isle"}]
    for snapshot in result["snapshots"]:
        claims = snapshot["residency"]["claims"]
        assert len({c["id"] for c in claims}) == len(claims)
        homes = [c for c in claims if c["id"] == "sim:driftwood-isle"]
        assert len(homes) == 1 and homes[0]["bytes"] == 341781982 and homes[0]["refs"] == 2
        platform = [c for c in claims if c["id"].startswith("platform:render:road.")]
        assert {c["id"].split(".")[-1] for c in platform} == parts
        assert all(c["bytes"] > 0 and c["needed"] for c in platform)
        cost = snapshot["residency"]["cost"]
        assert cost["playing"] <= 1000000000 and cost["loading"] <= 1800000000
        assert sum(c["bytes"] for c in claims) == cost["accounted"]
        assert snapshot["state"]["rings"]["refused"] == 0
        assert snapshot["state"]["rings"]["inFlight"] == snapshot["state"]["rings"]["queued"] == 0
        assert snapshot["state"]["rings"]["far"] == 8
        reveal = snapshot["reveal"]
        assert not reveal["ceiling"] and not reveal["skipped"]
        assert 0 <= reveal["endedMs"] - reveal["pathEndMs"] <= 1000
        assert reveal["ringsReadyMs"] is not None and reveal["homeSimMs"] is not None
    worst = max(s["residency"]["cost"]["playing"] for s in result["snapshots"])
    print(result["layout"], "PASS", worst, "bytes playing; margin", 1000000000 - worst)
