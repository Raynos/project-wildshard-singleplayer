# Sourced by the gate: at most three owned jobs, with an exclusive phase for Vitest.
gate_pids=()
gate_slot() {
  if [ "${#gate_pids[@]}" -ge 3 ]; then
    wait "${gate_pids[0]}" || true
    gate_pids=("${gate_pids[@]:1}")
  fi
}
gate_launch() {
  gate_slot
  "$@" &
  gate_pids+=("$!")
}
gate_drain() {
  local pid
  for pid in ${gate_pids[@]+"${gate_pids[@]}"}; do wait "$pid" || true; done
  gate_pids=()
}
gate_exclusive() {
  gate_drain
  "$@"
}
