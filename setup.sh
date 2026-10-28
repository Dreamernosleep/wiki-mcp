#!/usr/bin/env bash
#
# Wiki MCP installer
#
#   One-line install (downloads the project into ./wiki-mcp, then sets it up):
#     curl -fsSL https://raw.githubusercontent.com/Dreamernosleep/wiki-mcp/main/setup.sh | bash
#
#   Same, but keeps the interactive prompts:
#     bash <(curl -fsSL https://raw.githubusercontent.com/Dreamernosleep/wiki-mcp/main/setup.sh)
#
#   From a clone of the repository:
#     ./setup.sh               interactive
#     ./setup.sh --yes         accept all defaults, no prompts (CI / scripts)
#     ./setup.sh --no-start    configure only, do not start Docker
#
# What it does:
#   0. If not run inside the repository, downloads the source into ./wiki-mcp
#   1. Checks that Docker (with Compose v2) is installed and running
#   2. Creates .env from .env.example if it does not exist (never overwrites)
#   3. Generates a random MEILISEARCH_KEY if the current one is the placeholder
#   4. Asks for the API and UI ports (defaults 3000 / 80)
#   5. Starts the stack with Docker Compose, waits for the API to be healthy,
#      and prints the URLs plus a ready-to-paste MCP config block
#
# The only prerequisite is Docker. On Windows, run this inside WSL or Git Bash.

set -euo pipefail

REPO="Dreamernosleep/wiki-mcp"
REF="${WIKI_MCP_REF:-main}"
INSTALL_DIR="${WIKI_MCP_DIR:-wiki-mcp}"
PLACEHOLDER_KEY_PREFIX="change_me"
HEALTH_TIMEOUT=120

YES=0
NO_START=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --no-start) NO_START=1 ;;
    --help|-h)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done
# No terminal on stdin (curl | bash, CI): there is nobody to answer prompts.
if [ ! -t 0 ]; then YES=1; fi

# ---------------------------------------------------------------- output ----

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi

ok()   { echo "${GREEN}✔${RESET} $*"; }
warn() { echo "${YELLOW}!${RESET} $*"; }
fail() { echo "${RED}✖${RESET} $*" >&2; exit 1; }
step() { echo; echo "${BOLD}$1/5 $2${RESET}"; }

# ---------------------------------------------------------------- prompts ---

# ask "question" "default" -> prints the answer
ask() {
  local question="$1" fallback="$2" answer
  if [ "$YES" = 1 ]; then echo "$fallback"; return; fi
  read -r -p "  $question ${DIM}[$fallback]${RESET} " answer </dev/tty
  answer="${answer#"${answer%%[![:space:]]*}"}"
  answer="${answer%"${answer##*[![:space:]]}"}"
  if [ -z "$answer" ]; then echo "$fallback"; else echo "$answer"; fi
}

# confirm "question" -> exit status 0 for yes (default yes)
confirm() {
  local question="$1" answer
  if [ "$YES" = 1 ]; then return 0; fi
  read -r -p "  $question ${DIM}[Y/n]${RESET} " answer </dev/tty
  case "$(echo "$answer" | tr '[:upper:]' '[:lower:]')" in
    ''|y|yes) return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------- helpers ---

have() { command -v "$1" >/dev/null 2>&1; }

# sed -i differs between GNU and BSD/macOS. Write to a temp file instead.
sedi() {
  local expr="$1" file="$2" tmp
  tmp="$(mktemp)"
  sed "$expr" "$file" > "$tmp" && cat "$tmp" > "$file"
  rm -f "$tmp"
}

# env_get KEY -> value of KEY in .env (empty when missing)
env_get() {
  grep -E "^[[:space:]]*${1}[[:space:]]*=" .env 2>/dev/null | tail -n 1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr -d '\r' || true
}

# env_set KEY VALUE -> replace the line in place, or append it
env_set() {
  local key="$1" value="$2"
  if grep -qE "^[[:space:]]*${key}[[:space:]]*=" .env; then
    sedi "s|^\([[:space:]]*${key}[[:space:]]*=\).*|\1$value|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

random_hex_32() {
  if have openssl; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

is_wiki_repo() { [ -f docker-compose.yml ] && [ -f .env.example ]; }

# ---------------------------------------------------------------- main ------

echo
echo "${BOLD}Wiki MCP setup${RESET}"
echo "${DIM}Markdown wiki + MCP server + search + web UI, all self-hosted.${RESET}"
echo
if [ "$YES" = 1 ]; then echo "${DIM}Running non-interactively: using defaults for every prompt.${RESET}"; fi

# 0. Bootstrap: download the project when not run from inside it ------------
if ! is_wiki_repo; then
  have curl || fail "curl is required to download the project. Install it, or clone the repository and run ./setup.sh from there."
  have tar  || fail "tar is required to extract the project."
  if [ -e "$INSTALL_DIR" ]; then
    if [ -f "$INSTALL_DIR/docker-compose.yml" ] && [ -f "$INSTALL_DIR/.env.example" ]; then
      ok "Using existing $INSTALL_DIR/"
    else
      fail "$INSTALL_DIR already exists and is not a Wiki MCP checkout. Remove it or set WIKI_MCP_DIR to another folder."
    fi
  else
    echo "${DIM}  Downloading $REPO ($REF) into $INSTALL_DIR/ ...${RESET}"
    mkdir -p "$INSTALL_DIR"
    curl -fsSL "https://github.com/$REPO/archive/refs/heads/$REF.tar.gz" \
      | tar -xz -C "$INSTALL_DIR" --strip-components=1 \
      || fail "Download failed. Check your network, or clone https://github.com/$REPO and run ./setup.sh from there."
    ok "Downloaded into $INSTALL_DIR/"
  fi
  cd "$INSTALL_DIR"
fi
ROOT="$(pwd)"

# 1. Prerequisites -----------------------------------------------------------
step 1 "Checking prerequisites"

have docker || fail "Docker is not installed or not on PATH. Install Docker: https://docs.docker.com/get-docker/"
ok "$(docker --version)"

docker compose version >/dev/null 2>&1 \
  || fail 'Docker Compose v2 is missing ("docker compose"). It ships with Docker Desktop; on Linux install the docker-compose-plugin package.'
ok "$(docker compose version)"

docker info >/dev/null 2>&1 \
  || fail "Docker is installed but the daemon is not running. Start Docker Desktop (or: sudo systemctl start docker) and run setup again."
ok "Docker daemon is running"

# 2. .env --------------------------------------------------------------------
step 2 "Configuration file"

[ -f .env.example ] || fail ".env.example is missing; are you running this from the repository root?"

CREATED=0
if [ ! -f .env ]; then
  cp .env.example .env
  CREATED=1
  ok "Created .env from .env.example"
else
  ok ".env already exists, keeping your values"
fi

# 3. Meilisearch key ---------------------------------------------------------
step 3 "Search engine password"
echo "${DIM}  Meilisearch runs as a local container (open source, no account). The key is just a"
echo "  password that locks your own instance; nothing is sent to any service.${RESET}"

CURRENT_KEY="$(env_get MEILISEARCH_KEY)"
if [ -z "$CURRENT_KEY" ] || [ "${CURRENT_KEY#"$PLACEHOLDER_KEY_PREFIX"}" != "$CURRENT_KEY" ]; then
  env_set MEILISEARCH_KEY "$(random_hex_32)"
  ok "Generated a random MEILISEARCH_KEY"
else
  ok "MEILISEARCH_KEY is already set"
fi

# 4. Ports -------------------------------------------------------------------
step 4 "Ports"

ask_port() {
  local label="$1" key="$2" fallback="$3" current value
  current="$(env_get "$key")"
  [ -n "$current" ] && fallback="$current"
  while :; do
    value="$(ask "$label port" "$fallback")"
    if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]; then
      echo "$value"; return
    fi
    echo "${RED}  Please enter a number between 1 and 65535.${RESET}" >&2
  done
}

API_PORT="$(ask_port "API / MCP" API_PORT 3000)"
UI_PORT="$(ask_port "Web UI" UI_PORT 80)"
env_set API_PORT "$API_PORT"
env_set UI_PORT "$UI_PORT"
if [ "$CREATED" = 1 ]; then ok "Saved .env"; else ok "Saved .env ${DIM}(updated)${RESET}"; fi

# 5. Start -------------------------------------------------------------------
step 5 "Start the stack"

if [ "$UI_PORT" = 80 ]; then UI_URL="http://localhost"; else UI_URL="http://localhost:$UI_PORT"; fi
API_URL="http://localhost:$API_PORT"

START=0
if [ "$NO_START" = 0 ] && confirm "Build and start with Docker Compose now?"; then START=1; fi

if [ "$START" = 1 ]; then
  echo
  echo "${DIM}  Running: docker compose up -d --build  (first build takes a few minutes)${RESET}"
  echo
  docker compose up -d --build \
    || fail "docker compose failed. See the output above; 'docker compose logs' shows service logs."

  printf '\n  Waiting for the API to become healthy '
  HEALTH=""
  for _ in $(seq 1 $((HEALTH_TIMEOUT / 2))); do
    if HEALTH="$(curl -fsS --max-time 3 "$API_URL/health" 2>/dev/null)"; then break; fi
    HEALTH=""
    printf '.'
    sleep 2
  done
  echo
  if [ -z "$HEALTH" ]; then
    warn "The API did not answer within $HEALTH_TIMEOUT seconds. Check: docker compose logs -f wiki-api"
  elif echo "$HEALTH" | grep -q '"meilisearch":true'; then
    ok "API healthy, Meilisearch connected"
  else
    ok "API healthy (Meilisearch not ready yet, SQLite search in use)"
  fi
else
  echo "${DIM}  Skipped. Start later with:  docker compose up -d --build${RESET}"
fi

# Summary --------------------------------------------------------------------
echo
echo "${BOLD}Done.${RESET}"
echo
echo "  Web UI      ${CYAN}$UI_URL${RESET}"
echo "  REST API    ${CYAN}$API_URL/api${RESET}"
echo "  MCP server  ${CYAN}$API_URL/mcp${RESET}"
echo "  Your pages  ${CYAN}$ROOT/content${RESET}"
echo
echo "  Connect an AI agent (Claude Code, Cursor, ...) with:"
echo "${DIM}  {"
echo "    \"mcpServers\": {"
echo "      \"wiki\": {"
echo "        \"url\": \"$API_URL/mcp\""
echo "      }"
echo "    }"
echo "  }${RESET}"
echo
echo "  Useful commands (run inside $ROOT):"
echo "${DIM}    docker compose logs -f     follow logs"
echo "    docker compose down        stop (your data stays in ./content and ./data)"
echo "    ./setup.sh                 run this again (keeps your .env values)${RESET}"
echo
