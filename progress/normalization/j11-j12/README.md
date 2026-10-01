# J11 + J12: Nalati-only crouch and manual longbow draw

Jake's Wave 3 picks, built by sol-j11. No production pin or milestone baseline is changed here.

The before build is `b243f0c24df1121ee3f8cbc3cf36473fa2450423`; after is isolated runtime candidate
`7799453b6629365df79aa3f30eed8727927b5d36` (HEAD plus J11/J12 and J10's requested default keys).
Both use deterministic seed, Metal, desktop 1600×900, midday/clear and identical native DOM inputs with
60 simulated 30 Hz frames for the two-second actions. Every JPEG was visually inspected; browsers/previews closed.

| Case | Before | After | Intended delta |
|---|---|---|---|
| C + W held for 2 s at Pine's south gate | crouching; 4.276837419974536 m | standing; 8.360717086904753 m | walking uses 4.3 m/s rather than crouch's 2.2; no lowered eye / crouch jump restriction |
| Camera eye world y after that walk | 1.069891277023272 m | 1.717830043316224 m | standing eye; includes movement/bob, not a constant-height comparison |
| F then 2 s with Pine longbow | arrows 20 → 19 | arrows 20 → 20 | automatic draw/loose shortcut removed |
| LMB held 1 s then released | full charge 1, arrows 19 → 18 | full charge 1, arrows 20 → 19 | manual full-draw release still shoots one arrow |
| Pine ambient hare scare radius | crouch 7 m, walk 12 m, sprint 20 m | walk 12 m, sprint 20 m | closer crouch approach removed (source rule, not a hare capture) |

`before/` and `after/` contain the screenshots and exact observations. C/Ctrl are absent from the shared onFoot
bindings; Nalati's scoped crouch/touch eligibility and latch stay unchanged, with inherited RightCtrl now explicitly
in its stealth context. Existing saved overrides cannot put removed Controls rows back. J10's default key changes:
walking arrows alongside WASD, V/LeftAlt dodge, I/Tab bag; Explorer keeps its separate movement defaults.

Reproduce the action frames (the runner takes its own browser-lane slot):

```
node progress/normalization/j11-j12/capture.mjs <full-sha> <scratch-output-directory>
```

Pine's standard walk/combat before/after capture and exact changed fields are recorded in `parity-deltas.json`.
The standard scenarios use W and manual bow draws; neither should gain an intended combat delta. The milestone
re-baseline must retain these explicit J11/J12 action deltas and the input binding fingerprint changes.
