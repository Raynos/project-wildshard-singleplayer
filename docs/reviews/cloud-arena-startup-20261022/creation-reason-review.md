# Preserve browser context-creation diagnostics

2026-10-22. Diagnostic source change only, not a graphics repair or gameplay acceptance.

The startup helper now retains the latest nonempty webglcontextcreationerror statusMessage, trimmed and capped at1024 characters, and appends it to the existing terminal error. Its existing Scope disposes both listeners. Context options,250ms retry cadence,10second timeout and readiness semantics are unchanged.

Independent read-only review found no production blocker and verified public error sinks use textContent. A missing-property fixture gap was corrected to dispatch a plain Event; explicit undefined remains separately tested.

Final validation:14focused tests pass using the real Scope, focused strict TypeScript passes, unchanged-rule type-aware lint passes, whitespace check passes. Tests cover empty/invalid/absent reasons, replacement and cap, immediate/delayed success, existing failure categories and cleanup. Initial lint backend resource failures were retained; bounded single-job resource settings passed. No actual browser run or Site deployment is claimed for this source change.

Full pre-commit gate did not complete: its broad type-aware lint backend was SIGKILLed twice, including a bounded single-thread retry. Focused checks above passed, but are not a replacement for this gate. This checkpoint preserves unfinished sources only; no local landed commit, new build, deployment or full-gate acceptance is claimed.
