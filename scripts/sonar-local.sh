#!/usr/bin/env bash
# A full SonarQube analysis on this machine, in about a minute.
#
# The CI scan is the gate, but it takes ~10 minutes and only runs on a push,
# which is far too slow to iterate against when the goal is zero issues. This
# runs the SAME analyzers against a SonarQube Community container, so a rule
# that would fire in CI fires here first.
#
#   scripts/sonar-local.sh up       start the container (first run pulls ~1GB)
#   scripts/sonar-local.sh scan     analyse the working tree
#   scripts/sonar-local.sh issues   list what it found, newest analysis
#   scripts/sonar-local.sh down     stop and remove the container
#
# Differences from SonarCloud, stated so results are read correctly:
#   * Community edition has no PULL REQUEST analysis, so this scans the whole
#     tree rather than new code. Expect findings CI never shows you, on files
#     this branch did not touch - compare against a scan of `main` if in doubt.
#   * The analyzer versions track the container image, not SonarCloud, so a
#     brand-new rule may differ. It has agreed with CI on every rule so far.
#   * `sonar-project.properties` is read as-is; the SonarCloud project key and
#     organization are overridden on the command line rather than edited, so
#     nothing here can change what CI does.
set -euo pipefail

CONTAINER=kroma-sonarqube
HOST_URL=http://localhost:9000
TOKEN_FILE="${HOME}/.kroma/sonarqube-local-token"
PROJECT_KEY=kroma-local
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "error: $*" >&2; exit 1; }

up() {
  if docker inspect "$CONTAINER" >/dev/null 2>&1; then
    docker start "$CONTAINER" >/dev/null
  else
    docker run -d --name "$CONTAINER" -p 9000:9000 \
      -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
      sonarqube:community >/dev/null
  fi
  printf 'waiting for SonarQube'
  until curl -sf "$HOST_URL/api/system/status" 2>/dev/null | grep -q '"status":"UP"'; do
    printf '.'; sleep 5
  done
  echo " up → $HOST_URL"
  [ -f "$TOKEN_FILE" ] || cat <<EOF

No token yet. Create one (the first login forces a password change):

  curl -su admin:admin -X POST '$HOST_URL/api/users/change_password?login=admin&previousPassword=admin&password=<new>'
  curl -su admin:<new> -X POST '$HOST_URL/api/user_tokens/generate?name=kroma-local' \\
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' > $TOKEN_FILE
EOF
}

scan() {
  [ -f "$TOKEN_FILE" ] || die "no token at $TOKEN_FILE - run '$0 up' and follow the instructions"
  curl -sf "$HOST_URL/api/system/status" >/dev/null 2>&1 || die "SonarQube is not up - run '$0 up'"

  # Coverage is optional: a scan is about ISSUES here, and regenerating lcov
  # costs more than the whole analysis. Passed only when it already exists.
  local coverage=()
  [ -f "$REPO_ROOT/coverage/lcov.info" ] && coverage+=("-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info")

  docker run --rm \
    -e SONAR_HOST_URL="http://host.docker.internal:9000" \
    -e SONAR_TOKEN="$(cat "$TOKEN_FILE")" \
    -v "$REPO_ROOT:/usr/src" \
    sonarsource/sonar-scanner-cli \
    -Dsonar.projectKey="$PROJECT_KEY" \
    -Dsonar.organization= \
    -Dsonar.scm.disabled=true \
    "${coverage[@]}" \
    "$@"
}

issues() {
  [ -f "$TOKEN_FILE" ] || die "no token at $TOKEN_FILE"
  curl -su "$(cat "$TOKEN_FILE"):" \
    "$HOST_URL/api/issues/search?componentKeys=$PROJECT_KEY&resolved=false&ps=500" \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
print(f"open issues: {d.get(\"total\", 0)}")
for i in d.get("issues", []):
    where = i["component"].split(":", 1)[-1]
    print(f"  {where}:{i.get(\"line\")}  {i[\"rule\"]} [{i.get(\"severity\")}] {i[\"message\"][:110]}")
'
}

case "${1:-}" in
  up) up ;;
  scan) shift; scan "$@" ;;
  issues) issues ;;
  down) docker rm -f "$CONTAINER" >/dev/null 2>&1 && echo "removed $CONTAINER" ;;
  *) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ; exit 1 ;;
esac
