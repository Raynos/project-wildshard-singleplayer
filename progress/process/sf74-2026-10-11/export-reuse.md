# SF74 export reuse

The serialized pusher now checks an already-current source commit on the
clean export it has just measured, then deletes that export as before. Its
exact-SHA receipt lets the gate avoid a second extraction and generation.
The measured candidate stays inside this process and unchanged export.

All existing generated-byte, predecessor-policy, source-parent, witness
payload and exact-increase checks still execute. The separate receipt is
not a regeneration-commit proof: the gate retains its independent ratchet
check. Missing or mismatched receipts run the normal clean-export check.
HEAD moving during validation retries the immutable source snapshot.

Before the change, two added probes failed: no reusable receipt existed,
and a forged regeneration policy change reached “already current.” The
old gate still refused that forgery; this change moves that check into the
pusher's existing export before issuing a reusable receipt.

Final focused proof: all 17 regeneration/witness tests passed in 22.33 s,
with personal Git configuration disabled, six workers and nice 10. Every
previous case remains; three cases cover exact source isolation, forged
policy refusal, and one actual ratchet CLI measurement per already-current
export. The CLI fixture uses the real ratchet and generator, not a mock.
Scoped strict typing, touched type-aware lint and Bash syntax also passed.

The real push gate supplies the end-to-end timing after landing. No
fseventsd percentage reduction or full-gate wall-time improvement is
claimed from these focused results.
