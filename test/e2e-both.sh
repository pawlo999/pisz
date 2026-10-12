#!/bin/bash
# The browser suite on WebKit and Chromium at the same time — about 13 min
# instead of ~25 for `node test/e2e.test.mjs`, which runs them one after the
# other. Needs the app served (python3 serve.py 8791; PISZ_URL overrides).
# Each engine's output goes to test/out/e2e-<engine>.log; this prints the
# failures, the two totals and each engine's exit code, and exits non-zero
# if either failed.
#
# Memory (WSL has 11 GB and running out restarts it — ~/priv/CLAUDE.md): the
# two browsers' scope peaked at 2.9 GB counting file cache (which a cap
# reclaims before it kills), so they run under a 3 GB cap with no swap, and
# side by side only when 3.5 GB is free; otherwise one after the other under
# the same cap. PISZ_E2E_MODE=together|one-after-the-other overrides the
# choice. One run at a time on this machine (a lock).
cd "$(dirname "$0")/.." || exit 2
exec 9> "${XDG_RUNTIME_DIR:-/tmp}/pisz-e2e.lock"
flock -n 9 || { echo "another browser-suite run is going on this machine — wait for it"; exit 3; }
mkdir -p test/out
rm -f test/out/e2e-webkit.log test/out/e2e-chromium.log
export PISZ_URL="${PISZ_URL:-http://localhost:8791/}"
free_mb=$(awk '/^MemAvailable:/{print int($2 / 1024)}' /proc/meminfo)
if [ "$free_mb" -ge 3500 ]; then mode=together; else mode=one-after-the-other; fi
mode=${PISZ_E2E_MODE:-$mode}
echo "free memory ${free_mb} MB: engines run $mode"
cap() { systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 -- "$@"; }
run() { stdbuf -oL node test/e2e.test.mjs "$1" > "test/out/e2e-$1.log" 2>&1; }
export -f run
if [ "$mode" = together ]; then
  cap bash -c 'run webkit & w=$!; run chromium & c=$!; wait $w; echo $? > test/out/e2e-webkit.code; wait $c; echo $? > test/out/e2e-chromium.code'
else
  cap bash -c 'run webkit; echo $? > test/out/e2e-webkit.code; run chromium; echo $? > test/out/e2e-chromium.code'
fi
code=0
for e in webkit chromium; do
  c=$(cat "test/out/e2e-$e.code" 2>/dev/null || echo "none")
  rm -f "test/out/e2e-$e.code"
  case "$c" in
    0) note='';;
    137) note=' — killed: the 3 GB memory cap';;
    none) note=' — did not run (could systemd-run start a scope?)';;
    *) note='';;
  esac
  echo "== $e (exit $c$note)"
  [ -f "test/out/e2e-$e.log" ] && sed 's/\x1b\[[0-9;]*m//g' "test/out/e2e-$e.log" | grep -v Skipping | grep -E '✗|passed, |Error|timed out'
  [ "$c" = 0 ] || code=1
done
exit $code
