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
