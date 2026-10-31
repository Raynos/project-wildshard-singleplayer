# Guarded worker startup

The internal `sdk/tickWorkerHost.TickWorkerHost` optionally accepts a
`preparePayload` function after its deadline policy. Trusted imports can then
load while the parent admits assets. The worker receives no payload until
that function succeeds; `runTickWorker` waits for its one initialization
message before creating an adapter or committing. The original constructor-
owned 30-second request clock covers both operations without resetting.
Failure or disposal quarantines the worker and rejects initialization; a
late payload cannot restart it. Immediate callers keep their existing path.
Native physics hooks still admit assets, install the world and await the
complete initial checkpoint inside their original ten-second deadline.

Native physics teardown also owns pending startup. If the setup hook times
out, teardown still awaits its original session, disposes it and checks
that a subsequent step refuses. It starts no replacement world.
