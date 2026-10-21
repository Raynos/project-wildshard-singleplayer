# BUILD-SPEED — State (wildshard pane; ≤ 3 KB)

**Phase: Wave 1 landed except one Jake step; Waves 2–5 planned in full, not asked, not started (2026-10-21 ~10:50
Cancun).** Jake asked for a plan to read and rule on; the `wildshard` pane built Wave 1 after his rulings without being
asked to build. Jake (10-21): keep the work, revert nothing. Five waves in the plan: 1 stop the bleeding (5 phases),
2 commit and push path (5), 3 partition the Mac (5), 4 coordination (4), 5 rulebook, lint, receipts, budgets (4).

**Wave 1, landed:**
- 1.1 A `3d1bb44021`: lane vitest runs capped at 2 workers (CI unchanged).
- 1.2 A `cbfadb2c1e`: heavy-lane children at utility QoS on macOS; local vitest at nice 10.
- 1.3 A2 (outside the repo, backups kept): user-level `context7` removed from `~/.claude.json` (0 calls in 72 h;
  backup `~/.claude.json.bak-e491-*`); `context7`, `playwright`, `chrome-devtools` commented out in
  `~/.codex/config.toml` (1 call in 72 h; backup `~/.codex/config.toml.bak-e491`). Running sessions keep their servers
  until they restart.
- 1.3 A3 `1d3f8b09ee` + `ad53c0d614`: the browser reaper's matcher never matched a "Google Chrome for Testing.app"
  root (so a 4-day agent-browser Chrome survived); fixed; agent-browser sessions reaped at 24 h; an orphaned
  Playwright browser counts as dead only after 10 min (detached proofs leave live ones with no parent).
- 1.4 A1+A2 `a040b16556`: AGENTS.md and lanes/common.md carry the no-polling (10 min exec yield, proof-run beyond,
  never sleep/wait loops) and no-receipts lines; the coordinator re-briefed all five Codex lanes for their next
  boundary. 1.4 A3 same commit: `scripts/agent-time.py` prints the audit numbers (`--hours N`).
- 1.5: already met before the plan landed. Coordinator report checked with gh: quest cable `c8cf164dd6`, DW digest
  `fb781f41c1`; deploy runs 39617646471 and 39619243789 green on all 10 shards. No quarantine.

**Wave 1, not done:** 1.3 A1 Spotlight exclusion of `tmp/`, `node_modules/`, `dist/`, `.git/` needs Jake (Privacy
pane, or sudo). Wave 1 Verify not measured yet: run `python3 scripts/agent-time.py --hours 24` after a day of lane
work (targets: idle > 20 % during lane tests, Codex poll share < 10 %, MCP processes ≤ one set per session that uses
them, receipt counts flat). Last 2 h before the re-brief: Codex poll share 74 %.

**Waves 2–5:** planned phase by phase in BUILD-SPEED.md (approach, alternatives, deletes, verify, rollback, a ruling
slot each); nothing built, nothing asked. D1 ruled: keep a local pre-push of at most 45 s; Phase 2.4 re-planned on it.

**Rulings so far:** 1.1 A · 1.2 A · 1.3 A1+A2+A3 · 1.4 A1+A2+A3 · 1.5 fix both, never quarantine · D1 ≤ 45 s pre-push.
