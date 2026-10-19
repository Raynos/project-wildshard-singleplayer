# Codex usage: 36 hours, 17–18 October 2026

E488. Window: **17 October 16:18:41 → 19 October 04:18:41 UTC**, or
17 October 11:18:41 → 18 October 23:18:41 in Panama/Cancun.

**Verdict:** sustained SHARD-PLATFORM fleet work, carrying large contexts
through tens of thousands of model responses. Repeated proof failures,
coordination and status checks amplified it. There is no single runaway
session: the biggest accounts for 5.7% of input; the top ten total 28.1%.

## What the logs measure

| Measure | Last 36 hours |
| --- | ---: |
| Active Codex threads | 119, of which 113 started in the window |
| Model responses, including compaction | 43,733 |
| Model / reasoning | Every recorded response: GPT-6.1 Sol / high |
| Input tokens | 8,344,410,001 |
| Cached input, included above | 8,229,862,400 (98.63%) |
| Uncached input | 114,547,601 |
| Output tokens | 26,186,225 |
| Reasoning output, included above | 15,525,194 (59.3%) |
| Input per response | Median 188,799; p90 302,145; max 418,534 |
| Compactions | 236 |
| Explicit turn starts | 1,074 |

That is **1,215 model responses an hour**, continuously across the window.
An hour had a median of ten distinct active threads, peaking at fourteen;
this measures activity within an hour, not exact simultaneous concurrency.
Every active thread was in this repository. There was substantial building:
Git records 894 commits in the window, including 282 with Codex attribution.
Commit count does not measure feature value or tie each response to a commit.

## Where the work went

These are the five biggest sessions by input. Thread prefixes identify the
local rollouts; names describe their assigned work.

| Work | Thread | Responses | Input | Share |
| --- | --- | ---: | ---: | ---: |
| Pine static world: geography, crags, forest drawer (sp-x10) | `01a14ba3` | 2,351 | 479.3 M | 5.7% |
| Push, gate and deploy repair (sp-x7) | `01a149c4` | 1,743 | 374.1 M | 4.5% |
| Sky/Signal runtime deletion and Z1 lockstep | `01a14e77` | 1,540 | 348.1 M | 4.2% |
| Drive hitches, shader/upload work and profiling | `01a14dd4` | 1,036 | 202.5 M | 2.4% |
| Pine weather reactions and keyed sky | `01a14b67` | 1,116 | 195.7 M | 2.3% |

The remaining sessions cover the W2/W3 migrations: world scenes, creatures,
quests, rigs, materials, maps, memory and performance. The push lane is a
real cost, but cannot explain the whole burn. The earlier 12 October audit
found a much larger push-lane share; that historical share is not today's.

## What amplified the spend

1. **Large context on almost every step.** 63.2% of all input volume came
   from responses with at least 200,000 input tokens. Cache reuse worked
   well, but the same large context was still reused thousands of times.
   Short status replies and tool calls still arrive with that context.
   The 236 compaction responses alone processed 75.6 M input and generated
   1.42 M output tokens. Compaction itself is a smaller direct cost than the
   tens of thousands of intervening responses.

2. **Proof and repair churn.** There were **1,939 proof-run completion
   notices: 1,087 passed and 852 failed (43.9%)**. These include builds,
   captures and other proof jobs; this is not a test failure rate or a count
   of unique bugs. Pine's largest session received 123 such notices
   (49 failed); the pusher received 293 (109 failed). The older lane briefs
   explicitly demanded exact multi-pose look parity, physics walks, frame
   floors, Simulator checks, 17 headless, all-ten, types, lint and phone
   checks per landing. That scope makes a small code cut an extended job.
   Later G506/G507/G509 instructions reduce the scope; their existence does
   not undo the earlier responses.

3. **Coordination repeatedly brought work back through the model.** The
   transcripts contain **3,987 `[from …]` messages between agents**, in
   addition to the 1,939 proof completion notices. Examples include map
   order, file ownership, CPU holds, receipts and landing reports. Not every
   message starts a separate turn, and some prevent collisions. They are
   nevertheless a large stream to read and reconcile while coding.

4. **Many small tool/status steps.** There were 38,565 nested shell calls
   and 3,774 nested `write_stdin` calls, alongside 2,424 top-level `wait`
   calls. These are different levels of tool activity and must not be added
   together as unique model requests. A conservative content scan finds
   2,747 responses whose tool calls contain only status/poll patterns and
   2,931 containing only wait patterns. Together they carry about 1.00 B
   input tokens. This is a review target, not a claim that all those calls
   were waste: `git diff` and waiting for a running command are often useful.

5. **High reasoning everywhere.** All recorded work used the same model
   and high setting, including the pusher and maintenance steps. Thinking
   accounts for 15.5 M output tokens. This does not establish that a lower
   setting would have solved the engineering work correctly; it does show
   that routine operations did not use a cheaper configured setting.

Large rollout files are not a cost measure. The largest serialized tool
outputs were image results, including base64 payloads. Their file size is
not their model token count. This audit uses recorded token usage instead.

## What happened to the actual allowance

The account snapshots show:

- The original weekly window was already **96% used** at the audit start,
  and first reports 100% at **17 October 17:23:44 UTC**.
- A fresh weekly allowance appears at **17 October 20:40:41 UTC**, with
  0% used and a new reset timestamp. The logs establish the allowance change,
  but not who triggered it.
- That allowance first reports **100% used at 19 October 04:04:26 UTC**:
  approximately **31 hours 24 minutes** after the fresh allowance appeared.
- Credit balance drops from **57,241.148059 to 54,718.9138805**:
  **2,522.2341785 credits**. The drop occurs before the fresh allowance;
  the reported balance stays flat afterward through this audit's cutoff.

These are account-wide snapshots. Reporting can lag and different lanes
briefly report older values. The two reset epochs each have small timestamp
variations across lanes; those seconds are not separate allowance resets.
This is not a conversion from tokens to subscription percentage or dollars.

For relative comparison only, the published GPT-6.1 Sol Standard credit
rates give approximately **32,849 credits of token-equivalent work**:
62.6% cached input, 17.4% uncached input and 19.9% output. This is **not an
actual credit charge** or an estimate of included subscription usage.
The current configuration says `service_tier = "default"`; the response
records do not establish historical speed tier per request.

OpenAI's [Codex pricing documentation](https://developers.openai.com/codex/pricing)
states that model, context, reasoning, tool use and caching affect allowance
usage, and that credit rates do not determine included subscription usage.
It also documents shared Codex/ChatGPT Work limits and speed multipliers.

## Changes the evidence supports

- **Apply the existing reduced proof scope consistently.** One relevant
  batch check and the required boot; broader proofs once at a milestone.
  Investigate recurring failed jobs before launching another equivalent run.
- **Keep deterministic push and monitoring work in scripts.** Wake a model
  for a new actionable failure, not for each success, queue change or status
  update. The pusher's entire session is 4.5% of input, so eliminating it
  alone cannot solve the fleet's spend.
- **Remove routine inter-lane acknowledgements and receipt relays.** Use Git
  and the coordinator's state for facts already recorded there; interrupt
  another lane only when it needs to act.
- **Batch reads, edits and relevant checks.** Fewer inference steps through
  a 189 k median context address a larger sink than trimming final replies.
  Use a fresh, narrowly scoped task at a natural completion boundary; do not
  interrupt an in-flight lane or repeatedly restart it mid-job.
- **Reserve high reasoning for the engineering decisions that need it.**
  Routine status and push operations are candidates for a lower setting or
  no inference. This audit changes no model settings and stops no lanes.

No savings percentage is promised: the logs cannot tell us which failed
proofs or reasoning steps would have been unnecessary with a different setup.

## Method and verification

Enumerated **all 661 rollout files** in `~/.codex/sessions/` and
`~/.codex/archived_sessions/`; streamed all 119 with modification times in
the window. Filtered events by their UTC timestamp, including threads begun
before the window. Joined thread names and provenance from read-only
`state_5.sqlite`. No transcript, credential or account identifier is copied
into the report.

Summed per-response `token_usage_record.usage`, requiring the record's thread
to match its rollout and deduplicating globally by `response_id`. All 43,733
responses have native usage records; no cumulative totals were mistaken for
individual responses, and no estimates or fallback token counts are used.
Reasoning and cached tokens are subsets, not additional totals.

An independent sum of cumulative `event_msg.token_count` deltas gives
8,268,832,550 input tokens. All 236 compaction response IDs match native
records; adding their 75,552,371 input leaves a 25,080-token difference from
the native total (0.0003%), consistent with event timestamp boundaries.
The native records remain the audit source of truth.

The frozen [usage summary](usage-summary.json) contains all 119 session
totals and hourly aggregates. The audit's own first responses are included
where they precede the cutoff; later audit work is excluded. Remote activity
without local rollouts, Claude usage and unrecorded failed requests are
outside this audit. Account-wide snapshots may include activity outside it.
