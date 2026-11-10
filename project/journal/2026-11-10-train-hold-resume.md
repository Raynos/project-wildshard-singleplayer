# Resume a held train without deploying its old pin

The native cross-handle regression holds the owning shell at live 0649b30,
epoch one. Main's unpromoted pin still points to 6c1, which has that real
regression. Engine c89 supplies the reviewed atomic retry guard; only its
full exact CI and Ring 1 can admit the next cycle.

A policy-only unhold previously triggered a deploy of that old pin before
the train could select the corrected producer. Ignore only that metadata
path for push-triggered deploys. Keep the hold on while this workflow
change lands. After the corrected producer is green, publish the policy-only
resume and dispatch the normal hosted train. Its pin-only commit and its
explicit exact-source workflow dispatch still run every artifact gate,
header/API/SW check, strict browser journey, road and durable save oracle.

Pull requests, runtime/source changes, engine.pin.json and workflow changes
remain ordinary checked/deployed inputs. No failed status, proof, timeout,
backend, save epoch or production artifact is weakened or changed here.
The review caught a real unhold-to-pin window: an ordinary competing push
or explicit dispatch can still deploy the old pin. The production policy
now retains a minimum engine commit at c89. The selector, staging and
immediate pre-promotion paths require its exact immutable ancestry. Old
6c1 therefore refuses even if another push or dispatch overlaps resume.
The floor is committed while the explicit hold remains on, before resume.
It remains in the policy after resume; it never substitutes for producer
CI, Ring 1, same-run browser proofs or epoch checks. No global freeze or
peer publication exclusion is needed.

The follow-up J206 review has no MUST. Its test-coverage SHOULD is closed
with executable selector, staging admission and promotion controls. They
retain the floor across resume, refuse the old pin before mutation or
Vercel, admit the corrected commit and descendants, and refuse divergent,
foreign and unavailable ancestry. Actual GitHub ancestry also refuses
main's old 6c1 pin and admits c89. All 20 shell cases and workflow lint pass.
