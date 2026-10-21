# BUILD-SPEED — State (wildshard pane; ≤ 3 KB)

**Phase: Wave 1 ruled and being built (2026-10-21 ~10:00 Cancun).** Rulings: 1.1 A (2 vitest workers) · 1.2 A (utility
QoS + nice) · 1.3 A1+A2+A3 (Spotlight exclusion, no unused MCP servers in lanes, reap day-old browsers) · 1.4 A1+A2+A3
(Codex no-poll brief, no new receipts, `scripts/agent-time.py`) · 1.5 fix both red shards, never quarantine. D1 ruled
no: a local pre-push of at most 45 s stays, with very little duplication of pre-commit; Phase 2.4 re-planned around it.

**Building:** the `wildshard` pane lands Phases 1.1–1.4 one commit each; Phase 1.5 belongs to the owning lanes at
their next boundary (coordinator told). Each phase's Verify goes here before the next.

**Waiting on Jake:** the Spotlight sudo line (1.3 A1) once handed over; Wave 2 rulings after Wave 1's Verify.

**Verify so far:** none landed.
