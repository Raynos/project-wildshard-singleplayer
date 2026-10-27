# Claude burn audit, 2026-10-27

What took the active Claude account from 14 % weekly (03:17Z, 22:17 Cancun) to 70 % (16:17Z, 11:17 Cancun).
It is measured from every Claude transcript on this Mac (main sessions and subagents) between 08:00Z (03:00 Cancun)
and 16:20Z, with 03:00Z–08:00Z for comparison. Cost is weighted at Opus price ratios (input 1, output 5, cache write
1.25, cache read 0.1), in millions of input-token equivalents ("M").

## Headline

**Five Opus lanes ran with the 1M context window and only compacted near 967k tokens.** Their average context was
about **530k tokens**, and every API call reads that whole context back from cache. **Cache reads are 91 % of the
burn.** Output (thinking included) is 6 %, cache writes 3 %, and fresh input is about 0 %. The lanes made ~1,700 calls
each in 8 h (one every ~7 s), so each call cost ~53k units, about 0.003 % of the week.

- The hourly totals track the usage log at **~17 M per weekly point**: 582 M since 08:00Z for 33 points (37 → 70 %);
  910 M since 03:00Z for 56 points. Nothing outside these transcripts is needed to explain the climb.
- The lanes are **91 %** of the burn, the coordinator **8.5 %**, wildshard-v **0.4 %**, marketing (wildshard-2) **0.4 %**.
  Subagents of the lanes and the coordinator were 0.3 % since 03:00Z (one sp-o1 research agent and two coordinator agents).
- **G605 was not applied.** The account passed 50 % at 10:17Z, which is the step down to 3 Opus lanes, but all five
  lanes kept burning at 4 points an hour through 16:00Z.
- **57 % of lane burn went to non-graphical commits** (generator and producer rewrites, fixture repins, build-step
  refactors). That is Codex work under the "Opus for graphical work only" rule.

## Per session, 08:00Z → 16:20Z

| Lane | Session(s) | Calls | M | Share | Avg ctx | Calls > 300k | Compactions (at) |
|---|---|---|---|---|---|---|---|
| sp-o5 | 8d771941 | 2,057 | 118.5 | 20.4 % | 527k | 1,550 | 3 (~967k) |
| sp-o4 | 67ef5fd4 → ffe7285b | 1,882 | 108.8 | 18.7 % | 544k | 1,378 | 3 (~967k) |
| sp-o3 | 8bf832e9 → 34f41e47 | 1,843 | 108.3 | 18.6 % | 524k | 1,445 | 2 (~967k) |
| sp-o1 | 39d85db3 → 71f79073 | 1,621 | 99.0 | 17.1 % | 524k | 1,242 | 2 (~967k) |
| sp-o2 | ec9eaada | 1,524 | 93.8 | 16.1 % | 562k | 1,243 | 2 (~967k) |
| coordinator | 6d7cc37d | 1,084 | 49.3 | 8.5 % | 430k | 724 | 1 (~967k) |
| wildshard-v | 81cffee4 + 2 subagents | 67 | 2.5 | 0.4 % | 285k | 14 | 0 |
| wildshard-2 | 03b3c085 + 1 subagent | 79 | 2.0 | 0.4 % | 280k | 0 | 0 |

The session-to-lane map was checked against `herdr agent list` and the first prompt of each transcript.

**Context curve (every lane).** A fresh session starts at ~65k tokens; after a compaction it is back to 75–84k. It then
grows ~1.3k tokens a call, or ~290k an hour, so a lane goes from 80k to 967k in about 3 h and then auto-compacts.
Calls above 500k context make **71–79 % of each lane's burn**. Calls under 150k make 1–3 %.

**Hourly (M):** 03Z 32 · 04Z 21 · 05Z 29 · **06Z 141 · 07Z 104 · 08Z 108 · 09Z 96 · 10Z 92** · 11Z 54 · 12Z 61 ·
13Z 48 · 14Z 45 · 15Z 49. The peak, 01:00–05:00 Cancun, is all five lanes plus the coordinator active at full context.

## Top offenders

1. **The context ceiling itself (~60 % of the burn).** No tool output is to blame. Context grows from small steps
   adding up, and with the 1M window nothing resets it until 967k.
2. **Tiny turns at huge context (33–40 % of lane burn).** 36–45 % of lane calls produce fewer than 400 output tokens,
   such as "run the next check" or "read the next 40 lines". Lanes make almost one tool call per API call: 1.03 on
   average, and only 4–7 % of calls run tools in parallel. The median gap between calls is 6.5–8 s.
3. **The coordinator as a message sink (8.5 %).** It received **~300 pasted herdr messages** in 8 h (lane reports and
   `[push-loop] … red` notices), about one every 1.6 min. **70 % of its 1,084 calls** produce fewer than 400 tokens,
   yet each one reads ~430k tokens of context.
4. **Code-reading output that stays in context (~20 % of lane burn through re-reads).** Example results, with tokens
   in the result and the calls that re-read them:

   | Tool | Command or path | Lane | Result | Re-read by | M |
   |---|---|---|---|---|---|
   | git show/diff/log | 1,747 calls | all | | | 25.5 |
   | sed/cat/head | 1,023 calls | all | | | 20.5 |
   | grep | 1,033 calls | all | | | 12.2 |
   | build-shardfiles output | 689 calls | all | | | 9.8 |
   | Bash | `git show 4a5a2ed0cd -- …nalati…/coverSpecimens.ts …` | sp-o5 | 7.4k | 665 calls | 0.50 |
   | Bash | `sed -n 1,45p src/engine/entities/species/look.ts; …` | sp-o3 | 7.4k | 640 calls | 0.48 |
   | Bash | `for f in ambience.ts …; sed …` (pine generators) | sp-o3 | 7.7k | 516 calls | 0.41 |

   No single result was huge: the largest was ~8k tokens. Lanes already use `cut` and `head`, and no file was re-read
   more than 3 times. The cost comes from volume times re-reads.
5. **Non-graphical work on Opus (57 % of lane burn).** I gave each lane call's cost to the next commit that lane
   landed (386 of 449 Opus commits were matched by SHA). Generator and producer rewrites took **36 %**, build and
   other non-graphical work 13 %, and tests and fixtures 8 %. Docs and readings took 18 %, **graphical work
   (render, shaders, pacing, look) only 16 %**, and 10 % could not be attributed. Example non-graphical commits:
   `aa975d28b2 refactor(pine): retire the map-assembly job`, `304807fedd refactor(build): generators and products as
   steps`, `b4def1009a test(pine): quest content reads the built product`.

Not a factor: thinking or output (6 %), polling loops (no sleep or wait loops; one Monitor call), subagents (~0 %), and
re-reading the same file.

## Fixes, ranked by saving

| # | Fix | Saving (of today's burn) |
|---|---|---|
| 1 | **Cap lane and coordinator context at 200k**: set `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000` in the lane panes' env (the CLI names this as the way to enforce a window), and `/clear` at every row boundary. Simulated with the same calls on a 75k → 200k sawtooth, counting the extra compactions: **63 %** (56 % at 300k, 65 % at 150k). Realistic after re-reading lost context: **45–55 %** | **~50 %** |
| 2 | **Move generator and producer rewrites, fixture repins and build-step refactors to Codex lanes.** Opus keeps render, shaders, look and pacing. This removes 57 % of lane burn: **~50 % alone, ~25 % on top of fix 1** (fixes 1 and 2 together cut ~80 %, from 33 points per 8 h to ~6) | **~25 % after #1** |
| 3 | **Apply G605 on the hour.** At 50 % go to 3 Opus lanes, at 70 % go to 2. Today that would have dropped 2 lanes at 10:17Z | **~15 %** |
| 4 | **Stop pasting into the coordinator.** Lanes report landings in commits and STATE, and push-loop reds go to the owning lane. The coordinator reads a batch once an hour and runs under fix 1 | **~6 %** |
| 5 | **Fewer, fatter turns.** Run independent reads as parallel tool calls or one chained command, and don't re-run `git log` or `herdr` just to confirm a step. Each avoided call saves ~53k units today, ~14k after fix 1 | **~10 % now, ~4 % after #1** |
| 6 | **Trim the 65k start-up context.** AGENTS, CLAUDE and MEMORY are ~12k tokens; the system prompt, tools, skills and session brief are the rest. After fix 1 this base is about half of every call, so cutting 15k saves ~11 % of the remaining burn | **~5 %** |

Capping tool output (`git show --stat` before the full diff, a `sed` window of 80 lines or fewer) would cut only
~3–5 %, because results were already small.

**Do now:** fixes 1 and 3 need no plan change; fixes 2 and 4 are coordinator routing.

How this was measured: transcripts were streamed with Python, and the usage log is `~/.claude/usage-log/2026-W44.jsonl`.
Rough edges: tool-result tokens are estimated at 3.6 characters per token, and the commit classes come from a
heuristic on paths and subjects.
