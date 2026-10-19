# Bellback Frame2 anatomy-only corpse candidate2

Unaccepted. Original native geometry, payload, decision, dimensions, live poses,
root/body translation, physics and collision are unchanged. No optional corpse
shape implementation was needed for the observed baseline trajectory.

Death-only shoulder articulation: fore X=-.4rad/Z=±.4rad; hind X=-1.16rad/Z=±.24rad.
The fold smooths over .16 seconds using five times the existing deathT clock;
body/head/bell retain the original .8-second clock. Shoulder-local Y blends from
the original pose to exact bind .2599999904632568m plus .075m fore/.15m hind.
A hind-only transient .46*fold*(1-fold) shoulder offset prevents the early
local-space dip; the measured maximum shoulder offset is .2064253m and is
asserted below .21m. Settled offsets remain .075/.15m. No root lift, carrier
shrink, engine change or living-pose edit.

The preserved baseline observer has418 frames including134 actual death frames,
full root matrices and all8 bones. Baseline penetration is−.871147m transient
left hind foot, then−.120083m settled feet. Carrier/head/body never penetrate in
this observed death. A wider sideways-fold study removed penetration but lifted
hind feet .83m and was rejected. A slower bounded fold still penetrated .293m.

The chosen symmetric replay has zero frames below−5mm. Settled original feet
clearances are +19.35mm,+2.35mm,+13.94mm,+29.16mm. Three supporting feet are within
20mm; all four are within35mm. These are exact captured-root replay values, not
fresh runtime acceptance, visual support approval, or physics/phone performance.
Fresh candidate2 full collapse/settle/Retry observation remains mandatory.

Focused evidence:8 pose/source/world tests pass; dense201-sample-per-state
local envelope passes; living channels match the original exactly. Exact
original-support endpoint reduction is proved analytically on [-.52,.52] to
keep the numeric DAG within the existing128-node guard, never widen it.
