# Observe the actual native road transport

The complete hosted Chromium 210-second road trace shows 59.97 raw
server ticks/second while commands advance about 45.9/second and the
prediction ring fills. Whole worker callbacks are inexpensive; neither
the cumulative displayed TPS nor scheduling after a step establishes a
ServerClock defect. No clock or movement source is changed here.

The diagnostic CPU capture now also observes the existing unreliable
MessagePort envelopes in both real realms. It records bounded metadata
and a 64-byte binary header before native transfer, never reliable data
(names/chat), control payloads or saves. Actual sends retain their
receiver, arguments and transfer lists. Passive receive listeners and
the original descriptor are restored on stop. Capture overflow refuses
and is explicit. The native MessageChannel proof verifies unchanged
transferred payloads, buffer detachment, reliable exclusion and cleanup.
All existing road deadlines, release assertions and rendering remain.

The next hosted result must distinguish late page delivery, command
production and the server's admission using matching packet headers.
This is observation, not a claimed repair or a green production release.


J206's corrected read-only Opus review is saved as
singleplayer-road-ports-2253.json/.md outside Git. It found no MUST-FIX
and three failure-cleanup SHOULDs, all addressed: both realm cleanups
settle independently, packet evidence is saved before trace/source work,
and setup/stop failures still restore both observers. A changed foreign
prototype is preserved while our listeners/global are retired. Native
MessageChannel plus the existing release tests remain 15/15 green.
The packet proof so far is Node native, not a claimed browser pass.
