# Subagents are short-lived (Jake, E352, 2026-09-30)

Linked from [AGENTS.md](../../AGENTS.md). Subagents were 92 % of the plan usage that burned a whole weekly limit in
12 hours. Since 09-22, subagents that ran over 2 h cost 73 % of all subagent spend, ending at a median 600k context.
Every call re-reads the whole context. A subagent's prompt cache lives **5 minutes** (a main session's lives 1 h), so
after a longer wait the whole context is re-cached at full price.

- **The main agent builds by default.** Work through a plan's rows yourself, one after another. Spawn a subagent only
  for a read-heavy search that returns a conclusion, or a job that is truly independent, owns disjoint files and fits
  the caps below. "Several rows are open" is not a reason to parallelise.
- **At most 3 live subagents per main session, no forks, no subagent spawning subagents.**
  `.claude/hooks/guard-subagents.sh` enforces it; resumed agents count. Rare escape: `SKIP_SUBAGENT_CAP=1`. A session Jake
  grants more gets a per-session cap file, `~/.claude/state/subagent-cap/<session>/cap` (2026-10-07: 5 Opus slots for the
  SHARD-PLATFORM builder, relayed by his plan agent: *"Tell the builder I green light 5 opus subagent slots"*).
- **One job per subagent**, then it reports and ends. **Caps: 400k context, 90 min wall clock, ~200 turns**,
  whichever comes first. Put all three in the brief: "stop at 400k context, 90 min or ~200 turns. Commit what is done,
  update your Handoff, report what is left." The parent starts a **fresh** subagent for what is left.
- **Reports are 40 lines at most.** The detail goes in the Handoff ([ASKS.md → Handoffs](ASKS.md)): one live
  `## Handoff (<lane>)` section, overwritten at every commit (Done, Next, Owns, Learned, Done when).
- **Never recycle a finished subagent** with a new job; spawn a new one with a short brief. **No forks.**
- **Long waits belong to the main agent.** A subagent whose next step queues longer than ~4 min (a model batch, a
  capture, a CI or deploy run) commits, reports "queued: <exact command>" and ends. The main agent runs it with
  `run_in_background`. No `until …; sleep …` loops longer than 4 min anywhere.
- **Every brief says:** don't run `~/.claude/set-label.sh` (subagents share the coordinator's pane), mute browsers,
  capture as the phone, start previews from the scratchpad, and the rules of [GIT.md](GIT.md).
- **Shard build-out lines** (Jake, 2026-10-01): when a shard agent hits an engine gap it keeps building other rows and
  sends the request over herdr to the agent that owns the engine; it is never thrown away and restarted from scratch
  to prove a zero-gap run. Continue the same agent while its context allows; else its successor reads its Handoff.
