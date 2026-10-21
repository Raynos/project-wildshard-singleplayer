# BUILD-SPEED — State (wildshard pane; ≤ 3 KB)

**Phase: Wave 1 wrap-up (2026-10-21 10:35 Cancun). Done when three things land: Jake's Spotlight step, the six
commits on origin (the pusher's push in flight carries them), and the 24 h Verify numbers here tomorrow 10:30.**
Waves 2–5 are planned in full, not asked, not started. Jake (10-21): keep the Wave 1 work, revert nothing.

**Wave 1, landed (local main, 28 commits ahead of origin at 10:35; the pusher carries them):**
- 1.1 A `3d1bb44021` vitest 2 workers per lane run. Now: 7 runs, 10 workers (new runs at ≤ 2; older runs finish).
- 1.2 A `cbfadb2c1e` heavy-lane children at utility QoS, vitest nice 10. The builder has since refactored it into
  `launch_command()` with a G562 exemption (gate leases and marked ruler builds keep normal QoS); intent kept.
- 1.3 A2 outside the repo, backups kept: user-level `context7` removed from `~/.claude.json`; `context7`,
  `playwright`, `chrome-devtools` commented out in `~/.codex/config.toml`. Takes effect as sessions restart: 53 MCP
  processes at 10:35, same as before.
- 1.3 A3 `1d3f8b09ee` + `ad53c0d614` browser reaper matches Chrome for Testing roots; agent-browser at 24 h;
  orphans after 10 min.
- 1.4 A1+A2 `a040b16556` no-polling and no-receipts lines in AGENTS.md and lanes/common.md; all five Codex lanes
  re-briefed by the coordinator for their next boundary. Codex poll share: 74 % (08:30–10:30) → 54 % (09:30–10:30).
  1.4 A3 `scripts/agent-time.py`.
- 1.5 met before the plan: `c8cf164dd6`, `fb781f41c1`; deploy runs 39617646471 and 39619243789 green on 10/10 shards.

**Wave 1, open:**
- 1.3 A1 Spotlight: **done** 10:50 (Jake added all of `~/projects/games` in Spotlight's Search Privacy; `mdfind` finds
  0 files under `tmp/` and under the whole games tree, was 61). mds was still at 26 % a minute later, dropping the old
  entries; fseventsd (87 %) is the lanes' own file churn and stays.
- Verify at 24 h (10-22 10:30, this pane runs `python3 scripts/agent-time.py --hours 24` and records): idle during
  lane tests > 20 % median (10:35 sample: 28 % idle, load 42; this morning 0 %, load 86); Codex poll share < 10 %;
  MCP processes ≤ one set per session that uses them; receipts flat (`.git/proofs` 13,813 → 14,195 and `progress/`
  11,810 → 11,847 since 08:20: the rule reaches lanes at boundaries). A missed target becomes a row, not a hold.

**Rulings so far:** 1.1 A · 1.2 A · 1.3 A1+A2+A3 · 1.4 A1+A2+A3 · 1.5 fix both, never quarantine · D1 ≤ 45 s pre-push.
