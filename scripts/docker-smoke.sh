#!/usr/bin/env bash
# Checks a running CodeGym server (by default the one `docker compose up` starts): the UI loads,
# every language's toolchain is found, and Two Sum's reference solution is accepted in each.
#   scripts/docker-smoke.sh [http://localhost:8080]
set -euo pipefail

BASE=${1:-http://localhost:8080}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

api() { curl -fsS -X POST -H 'Content-Type: application/json' --data "${2:-null}" "$BASE/api/$1"; }

for _ in $(seq 1 60); do
  curl -fsS "$BASE/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "$BASE/api/health" >/dev/null || { echo "CodeGym didn't start at $BASE"; exit 1; }

curl -fsS "$BASE/" | grep -q '<div id="root">' || { echo "The UI isn't served at $BASE/"; exit 1; }
echo "ok   UI"

missing=$(api detect_runtimes | jq -r '.[] | select(.available | not) | .language')
if [ -n "$missing" ]; then
  echo "Missing toolchains:"; api detect_runtimes | jq -r '.[] | select(.available | not) | "  \(.language): \(.installHint)"'
  exit 1
fi
echo "ok   every toolchain found"

failed=0
for lang in python javascript typescript go java cpp rust; do
  file=$(ls "$ROOT/problems/solutions/$lang/two-sum."*)
  body=$(jq -n --arg lang "$lang" --rawfile code "$file" \
    '{ req: { problemId: "two-sum", language: $lang, code: $code, customInputs: [] } }')
  verdict=$(api submit_code "$body" | jq -r '.run.verdict // .verdict')
  if [ "$verdict" = accepted ]; then
    echo "ok   $lang"
  else
    echo "FAIL $lang: $verdict"; failed=1
  fi
done
exit $failed
