#!/usr/bin/env bash
#
# Pokreće se na produkcionom serveru iz GitHub Actions workflow-a. Skript mora
# fizički da se nalazi u: <deploy-root>/releases/<sha>-<attempt>/scripts/.
# Aktivna verzija se ne menja dok novi release ne prođe build, proveru šeme i
# health check na zasebnom lokalnom portu.

set -Eeuo pipefail

APP_NAME="${APP_NAME:-narodnanosnja}"
APP_PORT="${APP_PORT:-3007}"
SMOKE_PORT="${SMOKE_PORT:-39007}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

log() {
  printf '→ %s\n' "$1"
}

fail() {
  printf 'Deploy prekinut: %s\n' "$1" >&2
  exit 1
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
RELEASE_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd -P)
RELEASES_ROOT=$(cd -- "$RELEASE_DIR/.." && pwd -P)
DEPLOY_ROOT=$(cd -- "$RELEASES_ROOT/.." && pwd -P)
RELEASE_ID=$(basename -- "$RELEASE_DIR")
SOURCE_SHA=${RELEASE_ID%%-*}
CURRENT_LINK="$DEPLOY_ROOT/current"

[[ "$RELEASES_ROOT" == "$DEPLOY_ROOT/releases" ]] || \
  fail "skript nije pokrenut iz release strukture"
[[ "$DEPLOY_ROOT" == /var/www/* || "$DEPLOY_ROOT" == /srv/* ]] || \
  fail "deploy root mora biti pod /var/www ili /srv"
[[ "$RELEASE_ID" =~ ^[0-9a-f]{40}-[0-9]+$ ]] || \
  fail "release identifikator nije validan"
[[ "$APP_NAME" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || \
  fail "APP_NAME nije validan"
[[ "$APP_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && (( APP_PORT <= 65535 )) || \
  fail "APP_PORT nije validan"
[[ "$SMOKE_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && (( SMOKE_PORT <= 65535 )) || \
  fail "SMOKE_PORT nije validan"
[[ "$SMOKE_PORT" != "$APP_PORT" ]] || fail "SMOKE_PORT i APP_PORT moraju biti različiti"
[[ "$KEEP_RELEASES" =~ ^([1-9][0-9]?|100)$ ]] || fail "KEEP_RELEASES nije validan"
[[ -f "$RELEASE_DIR/package.json" ]] || fail "package.json nije pronađen"
[[ -f "$DEPLOY_ROOT/.env" ]] || fail "$DEPLOY_ROOT/.env ne postoji"

DEPLOY_LOCK="$DEPLOY_ROOT/.deploy.lock"
exec 9>"$DEPLOY_LOCK"
flock -w 180 9 || fail "drugi deploy ili cleanup još uvek koristi aplikaciju"

SMOKE_PID=""
ACTIVATION_STARTED=false
DEPLOY_CONFIRMED=false
ROLLBACK_IN_PROGRESS=false

stop_smoke() {
  if [[ -n "$SMOKE_PID" ]] && kill -0 "$SMOKE_PID" 2>/dev/null; then
    kill "$SMOKE_PID" 2>/dev/null || true
    wait "$SMOKE_PID" 2>/dev/null || true
  fi
}

cleanup_on_exit() {
  local status=$?
  local active_target=""
  trap - EXIT HUP INT TERM
  stop_smoke

  if (( status != 0 )); then
    if [[ "$ACTIVATION_STARTED" == "true" && \
          "$DEPLOY_CONFIRMED" != "true" && \
          "$ROLLBACK_IN_PROGRESS" != "true" ]] && \
          declare -F rollback >/dev/null; then
      if ! rollback; then
        printf 'KRITIČNO: automatski rollback nije uspeo. Potrebna je ručna intervencija.\n' >&2
      fi
    fi

    active_target=$(readlink -f -- "$CURRENT_LINK" 2>/dev/null || true)
    if [[ -d "$RELEASE_DIR" && \
          "$RELEASE_DIR" == "$RELEASES_ROOT/"* && \
          "$active_target" != "$RELEASE_DIR" ]]; then
      rm -rf -- "$RELEASE_DIR" || \
        printf 'Upozorenje: neuspešan release nije očišćen: %s\n' "$RELEASE_DIR" >&2
    fi
  fi

  exit "$status"
}

trap cleanup_on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Dependency lifecycle skripte ne smeju da dobiju pristup produkcionim tajnama
# ili korisničkim uploadima. Shared linkovi se dodaju tek posle npm ci.
[[ ! -e "$RELEASE_DIR/.env" && ! -L "$RELEASE_DIR/.env" ]] || \
  fail "release ne sme sadržati .env"
[[ ! -e "$RELEASE_DIR/public/uploads" && ! -L "$RELEASE_DIR/public/uploads" ]] || \
  fail "release ne sme sadržati public/uploads"

cd "$RELEASE_DIR"

log "Instalacija zaključanih zavisnosti"
DATABASE_URL="postgresql://build:build@127.0.0.1:1/build" \
  npm ci --legacy-peer-deps --no-audit --no-fund

log "Povezivanje shared podataka"
mkdir -p "$DEPLOY_ROOT/public/uploads" "$RELEASE_DIR/public"
ln -s "$DEPLOY_ROOT/.env" "$RELEASE_DIR/.env"
ln -s "$DEPLOY_ROOT/public/uploads" "$RELEASE_DIR/public/uploads"

log "Prisma validacija"
npx prisma validate
npx prisma generate

if [[ "${APPLY_DATABASE_MIGRATIONS:-false}" == "true" ]]; then
  log "Primena prethodno pregledanih Prisma migracija"
  npx prisma migrate deploy
else
  log "Automatske migracije su isključene"
fi

log "Provera kompatibilnosti produkcione baze i Prisma šeme"
set +e
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
SCHEMA_STATUS=$?
set -e
case "$SCHEMA_STATUS" in
  0) ;;
  2) fail "produkcijska baza nije usklađena sa Prisma šemom; prvo primeni pregledanu migraciju" ;;
  *) fail "Prisma nije mogao da proveri produkcijsku bazu" ;;
esac

log "Produkcijska izgradnja"
npm run build

SMOKE_LOG="$RELEASE_DIR/.smoke.log"

log "Provera release-a pre aktivacije"
DEPLOYMENT_SHA="$SOURCE_SHA" NODE_ENV=production PORT="$SMOKE_PORT" \
  node node_modules/next/dist/bin/next start \
  -H 127.0.0.1 -p "$SMOKE_PORT" > "$SMOKE_LOG" 2>&1 &
SMOKE_PID=$!

SMOKE_OK=false
SMOKE_RESPONSE=""
for _ in {1..30}; do
  SMOKE_RESPONSE=$(curl -fsS --max-time 5 \
    "http://127.0.0.1:${SMOKE_PORT}/api/health" 2>/dev/null || true)
  if [[ "$SMOKE_RESPONSE" == *'"status":"healthy"'* && \
        "$SMOKE_RESPONSE" == *"\"deployment\":\"${SOURCE_SHA}\""* ]]; then
    SMOKE_OK=true
    break
  fi
  sleep 1
done

if [[ "$SMOKE_OK" != "true" ]]; then
  tail -n 50 "$SMOKE_LOG" >&2 || true
  fail "novi release nije prošao health check"
fi
stop_smoke
SMOKE_PID=""
rm -f "$SMOKE_LOG"

PREVIOUS_TARGET=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_TARGET=$(readlink -f -- "$CURRENT_LINK")
  [[ "$PREVIOUS_TARGET" == "$RELEASES_ROOT/"* ]] || \
    fail "current pokazuje van release direktorijuma"
elif [[ -e "$CURRENT_LINK" ]]; then
  fail "$CURRENT_LINK postoji, ali nije simbolički link"
fi

start_app() {
  local app_dir=$1
  local deployment_sha=$2
  cd "$app_dir"
  pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
  PORT="$APP_PORT" NODE_ENV=production DEPLOYMENT_SHA="$deployment_sha" \
    pm2 start npm --name "$APP_NAME" -- start
}

wait_for_health() {
  local url=$1
  local expected_sha=$2
  local response
  for _ in {1..30}; do
    response=$(curl -fsS --max-time 5 "$url" 2>/dev/null || true)
    if [[ "$response" == *'"status":"healthy"'* && \
          "$response" == *"\"deployment\":\"${expected_sha}\""* ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_basic_health() {
  local url=$1
  local response
  for _ in {1..30}; do
    response=$(curl -fsS --max-time 5 "$url" 2>/dev/null || true)
    if [[ "$response" == *'"status":"healthy"'* ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

rollback() {
  printf '→ Nova verzija nije zdrava; vraćam prethodnu\n' >&2
  local rollback_dir
  local rollback_sha
  local exact_health=true
  ROLLBACK_IN_PROGRESS=true

  if [[ -n "$PREVIOUS_TARGET" && -d "$PREVIOUS_TARGET" ]]; then
    rollback_dir=$PREVIOUS_TARGET
    rollback_sha=$(basename -- "$PREVIOUS_TARGET")
    rollback_sha=${rollback_sha%%-*}
    local rollback_link="$DEPLOY_ROOT/.rollback-${RELEASE_ID}"
    if ! ln -s "$PREVIOUS_TARGET" "$rollback_link" || \
       ! mv -Tf "$rollback_link" "$CURRENT_LINK"; then
      printf 'Rollback link nije mogao da se vrati na %s\n' "$PREVIOUS_TARGET" >&2
      return 1
    fi
  else
    rollback_dir=$DEPLOY_ROOT
    rollback_sha=previous
    exact_health=false
    if ! rm -f -- "$CURRENT_LINK"; then
      printf 'Current link nije mogao da se ukloni tokom rollback-a\n' >&2
      return 1
    fi
  fi

  if ! start_app "$rollback_dir" "$rollback_sha"; then
    printf 'Prethodna PM2 verzija nije mogla da se pokrene\n' >&2
    return 1
  fi

  if [[ "$exact_health" == "true" ]]; then
    if ! wait_for_health \
      "http://127.0.0.1:${APP_PORT}/api/health" "$rollback_sha"; then
      printf 'Prethodni release nije prošao health check\n' >&2
      return 1
    fi
  elif ! wait_for_basic_health \
    "http://127.0.0.1:${APP_PORT}/api/health"; then
    printf 'Legacy verzija nije prošla health check\n' >&2
    return 1
  fi

  if ! pm2 save >/dev/null 2>&1; then
    printf 'PM2 rollback stanje nije moglo da se sačuva\n' >&2
    return 1
  fi
  return 0
}

log "Atomska aktivacija release-a"
ACTIVATION_STARTED=true
NEXT_LINK="$DEPLOY_ROOT/.current-${RELEASE_ID}"
ln -s "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

if ! start_app "$CURRENT_LINK" "$SOURCE_SHA"; then
  fail "PM2 nije pokrenuo novu verziju"
fi

if ! wait_for_health \
  "http://127.0.0.1:${APP_PORT}/api/health" "$SOURCE_SHA"; then
  pm2 logs "$APP_NAME" --err --lines 50 --nostream >&2 || true
  fail "lokalni produkcijski health check nije prošao"
fi

if [[ -n "${PRODUCTION_URL:-}" ]]; then
  log "Provera verzije kroz javni endpoint"
  if ! wait_for_health \
    "${PRODUCTION_URL%/}/api/health" "$SOURCE_SHA"; then
    fail "javni health check nije potvrdio novu verziju"
  fi
fi

pm2 save >/dev/null
DEPLOY_CONFIRMED=true

log "Čišćenje starih release-a"
mapfile -t ALL_RELEASES < <(
  find "$RELEASES_ROOT" -mindepth 1 -maxdepth 1 -type d \
    -exec stat -c '%Y %n' {} + | sort -rn | cut -d' ' -f2-
)
ACTIVE_TARGET=$(readlink -f -- "$CURRENT_LINK")
for ((INDEX=KEEP_RELEASES; INDEX<${#ALL_RELEASES[@]}; INDEX+=1)); do
  OLD_RELEASE=${ALL_RELEASES[$INDEX]}
  if [[ "$OLD_RELEASE" == "$RELEASES_ROOT/"* && \
        "$OLD_RELEASE" != "$ACTIVE_TARGET" ]]; then
    rm -rf -- "$OLD_RELEASE"
  fi
done

printf 'Objavljeno: %s\n' "$SOURCE_SHA"
