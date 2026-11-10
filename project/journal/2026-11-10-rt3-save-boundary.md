# RT3 durable-save boundary

Hosted source 50179df, deploy 42811514392, crosses all three real road
legs in Chromium within the unchanged bounds. The long leg takes about
197.5 seconds. Its independent diagnostic also crosses. Both then receive
savedOk false for the explicit Ember save. WebKit's whole journey passes.
Solo is not promoted. MMO v0.1.5 is a separate aligned release.

ForwardedStorage has no acknowledgement timer. A false result can come
from validation/write refusal before persistence or from the actual page
storage answer. The retained native profile stops before that explicit
save, so its empty IndexedDB fault list does not establish the cause.

This first forward adds value-free observations, not a speculative fix:
the real save/write/written/saved MessagePort envelopes, bounded native
IndexedDB failures and storage usage, plus the actual worker SaveStore's
existing schema-report boundary. The debugger resumes the unchanged
method and detaches. No document contents, player IDs, arbitrary keys or
received invalid values are exported. The manual native proof bundles
the real engine SaveStore and ForwardedStorage with the actual validator.
A malformed write returns false while preceding native writes succeed;
a separate valid schema write reaches an actual IndexedDB ConstraintError,
whose false acknowledgement returns through ForwardedStorage unchanged.
These observations run through the save, independently of the short CPU
capture window. The primary journey uses only passive page observations;
the worker debugger is restricted to the independent failure diagnosis.

J206 found three MUSTs: free-text privacy, debugger cleanup on refusal,
and a fabricated report fixture. They are addressed with allowlisted
categories/numeric constraints, independent cleanup with emergency detach
and retained partial evidence, and that actual implementation proof.
The SHOULDs also add an eight-second manual watchdog, validate the resolved
breakpoint lies in the actual report method, and bound errors while
retaining the latest reports. The proof also injects real transport
failures before resume and breakpoint removal; the worker must continue
and both the refusal and evidence must survive. No test runs in a hook.
All three native modes pass (120-122 ms observed work, each with an
eight-second watchdog); the shell checks and all 19 boundary tests pass.

All road limits, save assertions, timeouts and backends remain unchanged.
The next hosted failure must supply the missing causal evidence; no
root cause, whole RT3 completion or promotion is claimed by this change.

The local exact 6c8a2ec staged journey passes the explicit durable save and
earned return in Chromium, including the unchanged software grid backend.
That does not reproduce the earlier hosted refusal. Its post-return
diagnostic naturally sees the new document and retired worker, so it is
not causal save evidence. The observation callback now captures immediately
after the explicit save and before the unchanged assertion/navigation.
An early road refusal still captures once in cleanup. Estimate or debugger
cleanup failures retain the separately collected evidence and cannot
manufacture a successful save.

The local 0649b30 positive control observes request 100: cell and site
writes both receive native true acknowledgements, then saved true, with
no IndexedDB faults (about 491 MB used, 11.2 GB quota). The schema observer
refuses setup, so it supplies no validation evidence on that attempt.
Anonymous debugger scripts are now skipped before URL parsing, and setup
errors name a fixed stage rather than exporting source/error text. The
separate native class proof remains the schema observer's positive control.
The anonymous-script forward also admits the actual emitted three-megabyte
server runtime in a native worker (one resolved report method, no errors).
This is instrumentation setup evidence, not a gameplay success claim.

Hosted 6c8a2ec now passes both complete phone journeys on the unchanged
engine 83a4e87, including Chromium's durable Ember save and earned return
within 0.3 mm. No save source changed between that run and the earlier
false acknowledgement. The defect is therefore intermittent, not repaired.
Its promotion correctly refuses because newer shell 0649b30 is already on
main. Run 42821525583 carries the value-free failure observations; the
earlier red and unchanged limits remain recorded.

The later controlled storage proof is scripts/release-indexed-quota-proof.mjs,
outside hooks. It bundles the actual engine API supplied by the caller.
The same loopback-only native 3 MiB quota and measured download body make
baseline dc26bf8 return three true/nine false with QuotaExceededError;
the new implementation returns twelve true and both documents read back
exactly. The controlled override never targets a game/deployment origin.
Web Storage Estimate pads this Chromium's quota by 10 GiB, so the proof
uses the actual native CDP quota and usage rather than that padded value.

The proposed whole-cache unlink did not free charged bytes while a live
Cache handle retained them; that red prototype was not published. Known
resource entry deletion does free them. Review's new retry-vs-delete race
was reproduced on the uncommitted recovery prototype and fixed with full
per-key serialization. Actual native deletion ordering, close draining,
and retained real download facts after clearing the native timing buffer
all pass. These are real storage-edge controls, not retrospective evidence
of the unobserved historical hosted failure.

Engine source 63235ed is in normal queue 190, with J206 MUST and SHOULD
closed. The next exact green producer and hosted journey must still prove
the integrated source. No product cap, proof oracle, deadline, backend,
save epoch, database, identity or last good progress is changed or wiped.
