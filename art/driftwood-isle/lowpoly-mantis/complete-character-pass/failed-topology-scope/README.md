# Preserved rejected first build

The first build passed its geometry/export checks but failed the task's protected
surface scope on inspection: `scope-audit.json` lists changed triangulation on
40 parts whose vertex coordinates did not change. The initial scope script
reported those differences without asserting their absence; its PASS string
therefore covers vertex/material/joint preservation only, not the full intended
surface-preservation gate. This attempt is rejected and was never captured as
the candidate. The corrected main scope checker requires no changed protected
triangle sets. No failure bytes were overwritten.
