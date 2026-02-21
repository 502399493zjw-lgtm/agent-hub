#!/usr/bin/env bash
# ============================================================================
# 🐟 Seafood Market CLI — 水产市场命令行工具
# 
# Usage:
#   seafood-market install <type>/@<author>/<slug>   从水产市场安装资产
#   seafood-market search <query>                     搜索资产
#   seafood-market list                               列出已安装资产
#   seafood-market uninstall <type>/<slug>            卸载资产
#   seafood-market info <type>/<slug>                 查看资产详情
#
# Examples:
#   seafood-market install trigger/@xiaoyue/fs-event-trigger
#   seafood-market install skill/@cybernova/web-search
#   seafood-market search "文件监控"
# ============================================================================

set -euo pipefail

# === Config ===
REGISTRY_URL="${SEAFOOD_REGISTRY:-http://47.100.235.25:3000}"
INSTALL_BASE="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
LOCKFILE="$INSTALL_BASE/seafood-lock.json"
VERSION="0.1.0"

# === Colors ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# === Helpers ===
info()  { echo -e "${BLUE}ℹ${NC} $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $*"; }
err()   { echo -e "${RED}❌${NC} $*" >&2; }
fish()  { echo -e "${CYAN}🐟${NC} $*"; }

# Install directories per asset type
install_dir_for_type() {
  local type="$1"
  case "$type" in
    skill)    echo "$INSTALL_BASE/skills" ;;
    config)   echo "$INSTALL_BASE/configs" ;;
    plugin)   echo "$INSTALL_BASE/plugins" ;;
    trigger)  echo "$INSTALL_BASE/triggers" ;;
    channel)  echo "$INSTALL_BASE/channels" ;;
    template) echo "$INSTALL_BASE/templates" ;;
    *)        err "Unknown asset type: $type"; exit 1 ;;
  esac
}

# === Init lockfile ===
init_lockfile() {
  if [ ! -f "$LOCKFILE" ]; then
    echo '{"version":1,"installed":{}}' > "$LOCKFILE"
  fi
}

# Update lockfile entry
update_lockfile() {
  local key="$1" version="$2" location="$3"
  init_lockfile
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  python3 -c "
import json, sys
with open('$LOCKFILE','r') as f: lock = json.load(f)
lock['installed']['$key'] = {
    'version': '$version',
    'installedAt': '$now',
    'location': '$location'
}
with open('$LOCKFILE','w') as f: json.dump(lock, f, indent=2)
"
}

# Remove lockfile entry
remove_lockfile() {
  local key="$1"
  init_lockfile
  python3 -c "
import json
with open('$LOCKFILE','r') as f: lock = json.load(f)
lock['installed'].pop('$key', None)
with open('$LOCKFILE','w') as f: json.dump(lock, f, indent=2)
"
}

# === API Calls ===
api_search() {
  local query="$1" type="${2:-}"
  local url="$REGISTRY_URL/api/assets?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")&limit=20"
  if [ -n "$type" ]; then
    url="$url&type=$type"
  fi
  curl -sf "$url"
}

api_get_by_type_slug() {
  local type="$1" slug="$2" author_filter="${3:-}"
  # Search by name, filter by type (and optionally author)
  local result
  result=$(curl -sf "$REGISTRY_URL/api/assets?q=$slug&limit=50")
  echo "$result" | python3 -c "
import sys, json
d = json.load(sys.stdin)
author_filter = '$author_filter'
matches = [a for a in d['data']['assets'] if a['type'] == '$type' and a['name'] == '$slug']
if author_filter:
    # Further filter by author id
    author_matches = [a for a in matches if a.get('author',{}).get('id','') == author_filter]
    if author_matches:
        matches = author_matches
if not matches:
    # fallback: try partial match on name
    matches = [a for a in d['data']['assets'] if a['type'] == '$type' and '$slug' in a['name']]
    if author_filter:
        author_matches = [a for a in matches if a.get('author',{}).get('id','') == author_filter]
        if author_matches:
            matches = author_matches
if matches:
    # prefer the one with authorId (latest publish)
    best = sorted(matches, key=lambda a: a.get('author',{}).get('id',''), reverse=True)[0]
    json.dump(best, sys.stdout)
else:
    sys.exit(1)
"
}

# ============================================================================
# INSTALL
# ============================================================================
cmd_install() {
  if [ -z "${1:-}" ]; then
    err "Usage: seafood-market install <type>/@<author>/<slug>"
    echo "  Example: seafood-market install trigger/@xiaoyue/fs-event-trigger"
    exit 1
  fi

  local spec="$1"
  
  # Parse type/@author/slug or type/slug (legacy)
  if [[ "$spec" != */* ]]; then
    err "Format must be <type>/@<author>/<slug>, e.g. trigger/@xiaoyue/fs-event-trigger"
    exit 1
  fi
  
  local type="${spec%%/*}"
  local rest="${spec#*/}"
  local slug author_filter=""
  
  # Check if rest starts with @ (scoped: @author/slug)
  if [[ "$rest" == @* ]]; then
    # Extract @author and slug
    author_filter="${rest%%/*}"   # @author
    author_filter="${author_filter#@}"  # strip @
    slug="${rest#*/}"             # slug
  else
    # Legacy format: type/slug (no author scope)
    slug="$rest"
  fi

  fish "Seafood Market Install"
  echo ""
  info "Looking up ${BOLD}$type/${author_filter:+@$author_filter/}$slug${NC} in the market..."

  # Query the registry
  local asset_json
  if ! asset_json=$(api_get_by_type_slug "$type" "$slug" "$author_filter"); then
    err "Asset ${BOLD}$type/${author_filter:+@$author_filter/}$slug${NC} not found in the market."
    echo ""
    echo "  Try: seafood-market search $slug"
    exit 1
  fi

  # Extract metadata
  local display_name version author_name author_id readme asset_id
  display_name=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['displayName'])")
  version=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
  author_name=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['author']['name'])")
  author_id=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['author']['id'])")
  asset_id=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  readme=$(echo "$asset_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('readme','') or '')")

  echo -e "  ${BOLD}$display_name${NC} ${DIM}v$version${NC}"
  echo -e "  by ${CYAN}$author_name${NC} ${DIM}($author_id)${NC}"
  echo ""

  # Determine install directory
  local target_dir
  target_dir="$(install_dir_for_type "$type")/$slug"
  
  # Check if already installed
  if [ -d "$target_dir" ]; then
    warn "Already installed at $target_dir"
    read -rp "  Overwrite? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy] ]]; then
      echo "  Aborted."
      exit 0
    fi
    rm -rf "$target_dir"
  fi

  info "Installing to ${DIM}$target_dir${NC}..."
  mkdir -p "$target_dir"

  # --- Try downloading the actual package first ---
  local download_url="$REGISTRY_URL/api/assets/$asset_id/download"
  local tmp_package="/tmp/seafood-market-$$-pkg"
  local has_package=false

  if curl -sf -o "$tmp_package" -w '%{http_code}' "$download_url" | grep -q "200"; then
    has_package=true
    info "📦 Downloading package from registry..."

    # Detect file type and extract
    local file_type
    file_type=$(file -b "$tmp_package" 2>/dev/null || echo "unknown")

    if echo "$file_type" | grep -qi "gzip\|tar"; then
      tar xzf "$tmp_package" -C "$target_dir" --strip-components=1 2>/dev/null || \
      tar xzf "$tmp_package" -C "$target_dir" 2>/dev/null
    elif echo "$file_type" | grep -qi "zip"; then
      unzip -o -q "$tmp_package" -d "$target_dir" 2>/dev/null
      # If files are in a subdirectory, move them up
      local subdirs
      subdirs=$(find "$target_dir" -mindepth 1 -maxdepth 1 -type d)
      if [ "$(echo "$subdirs" | wc -l)" -eq 1 ] && [ -n "$subdirs" ]; then
        # Single subdirectory — move contents up
        mv "$subdirs"/* "$target_dir"/ 2>/dev/null
        mv "$subdirs"/.* "$target_dir"/ 2>/dev/null
        rmdir "$subdirs" 2>/dev/null
      fi
    else
      warn "Unknown package format, trying as tar.gz..."
      tar xzf "$tmp_package" -C "$target_dir" --strip-components=1 2>/dev/null || \
      unzip -o -q "$tmp_package" -d "$target_dir" 2>/dev/null || \
      { err "Could not extract package"; has_package=false; }
    fi

    rm -f "$tmp_package"

    if [ "$has_package" = true ]; then
      # Count extracted files
      local file_count
      file_count=$(find "$target_dir" -type f | wc -l | tr -d ' ')
      echo -e "  📦 Extracted ${BOLD}$file_count${NC} files from package"
    fi
  else
    rm -f "$tmp_package" 2>/dev/null
  fi

  # --- Fallback: generate from metadata if no package ---
  if [ "$has_package" = false ]; then
    info "No package available, generating from metadata..."
    echo "$asset_json" | python3 -c "
import sys, json, os

asset = json.load(sys.stdin)
target = '$target_dir'

readme = asset.get('readme') or ''
description = asset.get('description') or ''
display_name = asset.get('displayName', '')
tags = asset.get('tags', [])
category = asset.get('category', '')

skill_md = f'''---
name: {asset['name']}
display-name: {display_name}
description: {description}
version: {asset['version']}
author: {asset['author']['name']}
author-id: {asset['author']['id']}
tags: {', '.join(tags)}
category: {category}
---

# {display_name}

{description}

{readme}
'''

with open(os.path.join(target, 'SKILL.md'), 'w') as f:
    f.write(skill_md)
print(f'  Generated: SKILL.md from metadata')
"
  fi

  # --- Always write manifest.json ---
  echo "$asset_json" | python3 -c "
import sys, json, os

asset = json.load(sys.stdin)
target = '$target_dir'

manifest = {
    'schema': 1,
    'type': asset['type'],
    'name': asset['name'],
    'displayName': asset.get('displayName', ''),
    'version': asset['version'],
    'author': asset['author'],
    'description': asset.get('description', ''),
    'tags': asset.get('tags', []),
    'category': asset.get('category', ''),
    'installedFrom': 'seafood-market',
    'registryId': asset['id'],
    'hasPackage': $( [ "$has_package" = true ] && echo "True" || echo "False" ),
}
with open(os.path.join(target, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print(f'  Created: manifest.json')
"

  # Update lockfile (key includes author if known)
  local lock_key="$type/${author_id:+@$author_id/}$slug"
  update_lockfile "$lock_key" "$version" "$target_dir"

  echo ""
  ok "Installed ${BOLD}$display_name${NC} v$version"
  echo -e "   ${DIM}Location:${NC} $target_dir"
  echo -e "   ${DIM}Registry:${NC} $REGISTRY_URL/asset/$asset_id"
  echo -e "   ${DIM}Command:${NC}  seafood-market install $type/@$author_id/$slug"
  echo ""

  # Post-install hints per type
  case "$type" in
    skill)
      echo -e "   ${GREEN}Ready!${NC} Will be loaded in the next agent session."
      ;;
    config)
      echo -e "   To activate: ${BOLD}seafood-market apply config/$slug${NC}"
      ;;
    trigger)
      echo -e "   ${YELLOW}Check dependencies:${NC} fswatch (macOS) / inotifywait (Linux)"
      echo -e "   Quick start: see SKILL.md in the installed directory"
      ;;
    plugin)
      echo -e "   ${YELLOW}Requires restart:${NC} openclaw gateway restart"
      ;;
    channel)
      echo -e "   ${YELLOW}Requires config:${NC} Set credentials in openclaw.json, then restart"
      ;;
    template)
      echo -e "   To scaffold: ${BOLD}seafood-market apply template/$slug --workspace ./my-agent${NC}"
      ;;
  esac
  echo ""
}

# ============================================================================
# SEARCH
# ============================================================================
cmd_search() {
  if [ -z "${1:-}" ]; then
    err "Usage: seafood-market search <query>"
    exit 1
  fi

  local query="$1"
  fish "Searching the market for \"$query\"..."
  echo ""

  local result
  result=$(api_search "$query")

  echo "$result" | python3 -c "
import sys, json

d = json.load(sys.stdin)
assets = d['data']['assets']
total = d['data']['total']

if not assets:
    print('  No results found.')
    sys.exit(0)

print(f'  Found {total} result(s):')
print()

type_icons = {
    'skill': '🧩', 'config': '⚙️', 'plugin': '🔌',
    'trigger': '⚡', 'channel': '📡', 'template': '📋'
}

for a in assets:
    icon = type_icons.get(a['type'], '📦')
    score = a.get('hubScore', 0)
    author = a['author']['name']
    author_id = a['author']['id']
    print(f\"  {icon} {a['displayName']}\")
    print(f\"     {a['type']}/@{author_id}/{a['name']}  •  v{a['version']}  •  by {author}  •  Score: {score}\")
    desc = (a.get('description') or '')[:80]
    if desc:
        print(f'     {desc}')
    print()
"
}

# ============================================================================
# LIST (installed)
# ============================================================================
cmd_list() {
  fish "Installed from Seafood Market"
  echo ""
  
  init_lockfile
  python3 -c "
import json
with open('$LOCKFILE') as f: lock = json.load(f)
installed = lock.get('installed', {})
if not installed:
    print('  Nothing installed yet.')
    print('  Try: seafood-market search web-search')
else:
    for key, info in sorted(installed.items()):
        ver = info.get('version','?')
        loc = info.get('location','?')
        ts = info.get('installedAt','?')[:10]
        print(f'  📦 {key}  v{ver}  ({ts})')
        print(f'     {loc}')
        print()
"
}

# ============================================================================
# UNINSTALL
# ============================================================================
cmd_uninstall() {
  if [ -z "${1:-}" ]; then
    err "Usage: seafood-market uninstall <type>/<slug>"
    exit 1
  fi

  local spec="$1"
  local type="${spec%%/*}"
  local slug="${spec#*/}"
  slug="${slug##*/}"

  local target_dir
  target_dir="$(install_dir_for_type "$type")/$slug"

  if [ ! -d "$target_dir" ]; then
    err "$type/$slug is not installed"
    exit 1
  fi

  fish "Uninstalling $type/$slug..."
  rm -rf "$target_dir"
  remove_lockfile "$type/$slug"
  ok "Uninstalled $type/$slug"
  echo -e "   ${DIM}Removed: $target_dir${NC}"
}

# ============================================================================
# INFO
# ============================================================================
cmd_info() {
  if [ -z "${1:-}" ]; then
    err "Usage: seafood-market info <type>/<slug>"
    exit 1
  fi

  local spec="$1"
  local type="${spec%%/*}"
  local slug="${spec#*/}"
  slug="${slug##*/}"

  info "Looking up $type/$slug..."
  
  local asset_json
  if ! asset_json=$(api_get_by_type_slug "$type" "$slug"); then
    err "Not found: $type/$slug"
    exit 1
  fi

  echo "$asset_json" | python3 -c "
import sys, json

a = json.load(sys.stdin)
print()
print(f\"  🐟 {a['displayName']}\")
print(f\"  {'─' * 40}\")
print(f\"  Type:     {a['type']}\")
print(f\"  Package:  {a['name']}\")
print(f\"  Version:  {a['version']}\")
print(f\"  Author:   {a['author']['name']} ({a['author']['id']})\")
print(f\"  Score:    {a.get('hubScore', 0)}\")
print(f\"  Downloads:{a.get('downloads', 0)}\")
tags = ', '.join(a.get('tags',[]))
if tags:
    print(f'  Tags:     {tags}')
desc = a.get('description','')
if desc:
    print(f'  ')
    print(f'  {desc}')
print()
author_id = a['author']['id']
print(f\"  Install:  seafood-market install {a['type']}/@{author_id}/{a['name']}\")
print()
"
}

# ============================================================================
# ============================================================================
# AUTHORIZE — Register this device with the hub (one-time setup)
# ============================================================================

cmd_authorize() {
  local device_id
  device_id=$(get_device_id) || {
    err "No OpenClaw device identity found at $DEVICE_JSON"
    exit 1
  }

  echo ""
  fish "Device Authorization"
  echo ""
  echo "  Device ID: ${device_id:0:16}..."
  echo ""
  echo "  To authorize this device, you need:"
  echo "    1. An account on ${BOLD}${REGISTRY_URL}${NC} (GitHub/Google login)"
  echo "    2. An activated invite code"
  echo ""
  echo "  Then authorize via the web UI, or ask your Agent to call:"
  echo "    POST /api/auth/device  { \"deviceId\": \"$device_id\" }"
  echo ""
  echo "  Once authorized, you can publish with: ${BOLD}seafood-market publish ./${NC}"
  echo ""
}

# ============================================================================
# DEVICE ID — Read from OpenClaw identity
# ============================================================================
DEVICE_JSON="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}/identity/device.json"

get_device_id() {
  if [ -f "$DEVICE_JSON" ]; then
    python3 -c "import json; print(json.load(open('$DEVICE_JSON'))['deviceId'])" 2>/dev/null
  else
    return 1
  fi
}

# ============================================================================
# PUBLISH — Publish a local skill directory to the market
# ============================================================================
cmd_publish() {
  local skill_dir="${1:-.}"
  
  # Resolve to absolute path
  skill_dir="$(cd "$skill_dir" && pwd)"

  local skill_md="$skill_dir/SKILL.md"
  if [ ! -f "$skill_md" ]; then
    err "No SKILL.md found in $skill_dir"
    echo "  SKILL.md is required to publish. It should have YAML frontmatter with name, description, etc."
    exit 1
  fi

  fish "Publishing from ${BOLD}$skill_dir${NC}"
  echo ""

  # Get device ID from OpenClaw identity
  local device_id
  device_id=$(get_device_id) || {
    err "No OpenClaw device identity found."
    echo ""
    echo "  Expected: $DEVICE_JSON"
    echo "  Make sure OpenClaw is installed and has been started at least once."
    echo ""
    echo "  Your device must be authorized first:"
    echo "    1. Login on ${BOLD}${REGISTRY_URL}${NC} (GitHub/Google)"
    echo "    2. Activate an invite code"
    echo "    3. Authorize this device (your deviceId will be auto-detected)"
    exit 1
  }

  info "Device ID: ${device_id:0:12}..."

  # Parse SKILL.md frontmatter + content using Python
  local payload
  payload=$(SKILL_DIR="$skill_dir" python3 << 'PYEOF'
import sys, json, re, os

skill_dir = os.environ.get("SKILL_DIR", ".")
skill_md = os.path.join(skill_dir, "SKILL.md")

with open(skill_md, "r") as f:
    content = f.read()

# Parse YAML frontmatter (between --- and ---)
fm = {}
body = content
m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
if m:
    import re as re2
    fm_text = m.group(1)
    body = m.group(2).strip()
    # Simple YAML-like parser for flat keys
    for line in fm_text.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        km = re.match(r'^(\w+)\s*:\s*(.*)', line)
        if km:
            key = km.group(1)
            val = km.group(2).strip().strip('"').strip("'")
            fm[key] = val

name = fm.get("name", os.path.basename(skill_dir))
description = fm.get("description", "")

# Detect type from metadata or default to skill
asset_type = fm.get("type", "skill")

# Build payload
payload = {
    "name": name,
    "displayName": fm.get("displayName", name),
    "type": asset_type,
    "description": description,
    "version": fm.get("version", "1.0.0"),
    "readme": body,
    "tags": [t.strip() for t in fm.get("tags", "").split(",") if t.strip()] if fm.get("tags") else [],
    "category": fm.get("category", ""),
    "longDescription": fm.get("longDescription", description),
}

# Author info from env or frontmatter
payload["authorId"] = os.environ.get("SEAFOOD_AUTHOR_ID", fm.get("authorId", ""))
payload["authorName"] = os.environ.get("SEAFOOD_AUTHOR_NAME", fm.get("authorName", ""))
payload["authorAvatar"] = os.environ.get("SEAFOOD_AUTHOR_AVATAR", fm.get("authorAvatar", ""))

print(json.dumps(payload))
PYEOF
  ) || {
    err "Failed to parse SKILL.md"
    exit 1
  }

  # Show preview
  echo "  $(echo "$payload" | python3 -c "
import json, sys
p = json.load(sys.stdin)
print(f\"  Name:        {p['name']}\")
print(f\"  Display:     {p['displayName']}\")
print(f\"  Type:        {p['type']}\")
print(f\"  Version:     {p['version']}\")
print(f\"  Description: {p['description'][:80]}\")
tags = ', '.join(p.get('tags', []))
if tags:
    print(f\"  Tags:        {tags}\")
author = p.get('authorName', '') or p.get('authorId', 'unknown')
print(f\"  Author:      {author}\")
")"
  echo ""

  # Confirm
  read -rp "  Publish to $REGISTRY_URL? [Y/n] " confirm
  if [[ "${confirm:-Y}" =~ ^[Nn] ]]; then
    info "Cancelled."
    exit 0
  fi

  # POST to API
  local response http_code
  response=$(curl -s -w "\n%{http_code}" -X POST "$REGISTRY_URL/api/assets" \
    -H "Content-Type: application/json" \
    -H "X-Device-ID: $device_id" \
    -d "$payload")
  
  http_code=$(echo "$response" | tail -1)
  local body_resp
  body_resp=$(echo "$response" | sed '$d')

  if [ "$http_code" = "201" ]; then
    local asset_id install_cmd
    asset_id=$(echo "$body_resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null || echo "unknown")
    install_cmd=$(echo "$body_resp" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'].get('installCommand',''))" 2>/dev/null || echo "")
    echo ""
    ok "Published successfully! 🎉"
    echo ""
    echo "  ID:      $asset_id"
    echo "  Install: $install_cmd"
    echo "  Page:    $REGISTRY_URL/asset/$asset_id"
    echo ""
  else
    local error_msg
    error_msg=$(echo "$body_resp" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','Unknown error'))" 2>/dev/null || echo "$body_resp")
    err "Publish failed (HTTP $http_code): $error_msg"
    exit 1
  fi
}

# ============================================================================
# MAIN
# ============================================================================
cmd_help() {
  echo ""
  echo -e "  ${BOLD}🐟 Seafood Market${NC} v$VERSION — 水产市场命令行工具"
  echo ""
  echo "  Usage: seafood-market <command> [args]"
  echo ""
  echo "  Commands:"
  echo "    install <type>/@<author>/<slug>     Install an asset from the market"
  echo "    uninstall <type>/<slug>             Uninstall an asset"
  echo "    search <query>                      Search the market"
  echo "    list                                List installed assets"
  echo "    info <type>/<slug>                  View asset details"
  echo "    publish <path>                      Publish a skill to the market"
  echo "    authorize                           Show device authorization info"
  echo "    help                                Show this help"
  echo ""
  echo "  Asset types: skill, config, plugin, trigger, channel, template"
  echo ""
  echo "  Examples:"
  echo "    seafood-market install trigger/@xiaoyue/fs-event-trigger"
  echo "    seafood-market install skill/@cybernova/web-search"
  echo "    seafood-market search \"文件监控\""
  echo "    seafood-market list"
  echo ""
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    install)    cmd_install "$@" ;;
    uninstall)  cmd_uninstall "$@" ;;
    search)     cmd_search "$@" ;;
    list)       cmd_list "$@" ;;
    info)       cmd_info "$@" ;;
    publish)    cmd_publish "$@" ;;
    authorize)  cmd_authorize "$@" ;;
    login)      cmd_authorize "$@" ;;  # alias for backward compat
    help|--help|-h) cmd_help ;;
    *)
      err "Unknown command: $cmd"
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
