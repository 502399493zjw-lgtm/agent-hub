#!/usr/bin/env python3
"""
Batch import GitHub assets to Agent Hub via admin API.

Features:
  - Serial execution with configurable delay between requests
  - Health check before each import (GET /api/health or /)
  - Automatic retry with exponential backoff on failure
  - Timeout per request (default 180s)
  - Detailed progress & summary report
  - Single-file path detection (skips full tree fetch on server side)

Usage:
  python3 scripts/batch-import-github.py --config imports.json
  python3 scripts/batch-import-github.py --repo owner/repo --paths "usecases/a.md,usecases/b.md" --type experience

Config JSON format:
  {
    "base_url": "http://localhost:3001",
    "admin_secret": "xxx",
    "delay_seconds": 3,
    "timeout_seconds": 180,
    "max_retries": 2,
    "imports": [
      { "repo": "owner/repo", "path": "subdir/file.md", "type": "experience" },
      ...
    ]
  }
"""

import argparse
import json
import sys
import time
import urllib.request
import urllib.error

DEFAULT_BASE_URL = "http://localhost:3001"
DEFAULT_DELAY = 3
DEFAULT_TIMEOUT = 180
DEFAULT_MAX_RETRIES = 2


def health_check(base_url: str, timeout: int = 10) -> bool:
    """Check if the dev server is responsive."""
    try:
        req = urllib.request.Request(f"{base_url}/", method="HEAD")
        urllib.request.urlopen(req, timeout=timeout)
        return True
    except Exception:
        return False


def wait_for_server(base_url: str, max_wait: int = 60) -> bool:
    """Wait for server to become healthy, up to max_wait seconds."""
    print(f"  ⏳ Waiting for server at {base_url}...", end="", flush=True)
    start = time.time()
    while time.time() - start < max_wait:
        if health_check(base_url):
            print(" ✅")
            return True
        print(".", end="", flush=True)
        time.sleep(3)
    print(" ❌ timeout")
    return False


def import_one(base_url: str, admin_secret: str, item: dict, timeout: int = 180) -> dict:
    """Import a single asset. Returns {"success": bool, "data": ..., "error": ...}."""
    url = f"{base_url}/api/admin/import-github"
    payload = {"repo": item["repo"]}
    if item.get("path"):
        payload["path"] = item["path"]
    if item.get("type"):
        payload["type"] = item["type"]
    if item.get("category"):
        payload["category"] = item["category"]

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-admin-secret": admin_secret,
        },
        method="POST",
    )

    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        body = json.loads(resp.read().decode("utf-8"))
        return body
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8", errors="replace")[:500]
        except Exception:
            pass
        return {"success": False, "error": f"HTTP {e.code}", "detail": error_body}
    except urllib.error.URLError as e:
        return {"success": False, "error": f"Connection error: {e.reason}"}
    except TimeoutError:
        return {"success": False, "error": "Request timeout"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def run_batch(config: dict):
    base_url = config.get("base_url", DEFAULT_BASE_URL)
    admin_secret = config.get("admin_secret", "")
    delay = config.get("delay_seconds", DEFAULT_DELAY)
    timeout = config.get("timeout_seconds", DEFAULT_TIMEOUT)
    max_retries = config.get("max_retries", DEFAULT_MAX_RETRIES)
    imports = config.get("imports", [])

    if not admin_secret:
        print("❌ admin_secret is required")
        sys.exit(1)
    if not imports:
        print("❌ No imports specified")
        sys.exit(1)

    # Initial health check
    if not wait_for_server(base_url):
        print("❌ Server not reachable, aborting.")
        sys.exit(1)

    total = len(imports)
    success_count = 0
    fail_count = 0
    failures = []

    print(f"\n🚀 Starting batch import: {total} items\n")

    for idx, item in enumerate(imports, 1):
        label = item.get("path") or item.get("repo", "?")
        print(f"[{idx}/{total}] {label}")

        result = None
        for attempt in range(1, max_retries + 2):  # +2 because range is exclusive & attempt starts at 1
            result = import_one(base_url, admin_secret, item, timeout)

            if result.get("success"):
                asset = result.get("data", {}).get("asset", {})
                print(f"  ✅ {asset.get('name', '?')} (type={asset.get('type', '?')}, files={asset.get('fileCount', 0)})")
                success_count += 1
                break
            else:
                error = result.get("error", "Unknown")
                print(f"  ⚠️  Attempt {attempt} failed: {error}")

                if attempt <= max_retries:
                    # Check if server is still alive
                    if not health_check(base_url):
                        print("  🔄 Server appears down, waiting for recovery...")
                        if not wait_for_server(base_url, max_wait=120):
                            print("  ❌ Server did not recover, skipping remaining imports.")
                            failures.append({"item": label, "error": "Server down"})
                            fail_count += 1
                            break
                    backoff = delay * (2 ** (attempt - 1))
                    print(f"  ⏳ Retrying in {backoff}s...")
                    time.sleep(backoff)
                else:
                    print(f"  ❌ Failed after {max_retries + 1} attempts")
                    failures.append({"item": label, "error": error, "detail": result.get("detail", "")[:200]})
                    fail_count += 1

        # Delay between requests
        if idx < total:
            time.sleep(delay)

    # Summary
    print(f"\n{'=' * 50}")
    print(f"📊 Import complete: {success_count}✅ / {fail_count}❌ / {total} total")
    if failures:
        print(f"\n❌ Failures:")
        for f in failures:
            print(f"  - {f['item']}: {f['error']}")
            if f.get("detail"):
                print(f"    {f['detail'][:200]}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Batch import GitHub repos to Agent Hub")
    parser.add_argument("--config", help="Path to config JSON file")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--admin-secret", default="")
    parser.add_argument("--repo", help="Single repo (owner/repo)")
    parser.add_argument("--paths", help="Comma-separated sub-paths")
    parser.add_argument("--type", default="skill", help="Asset type for all imports")
    parser.add_argument("--delay", type=int, default=DEFAULT_DELAY)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    args = parser.parse_args()

    if args.config:
        with open(args.config) as f:
            config = json.load(f)
    elif args.repo:
        paths = [p.strip() for p in (args.paths or "").split(",") if p.strip()]
        if not paths:
            imports = [{"repo": args.repo, "type": args.type}]
        else:
            imports = [{"repo": args.repo, "path": p, "type": args.type} for p in paths]
        config = {
            "base_url": args.base_url,
            "admin_secret": args.admin_secret or "",
            "delay_seconds": args.delay,
            "timeout_seconds": args.timeout,
            "imports": imports,
        }
    else:
        parser.print_help()
        sys.exit(1)

    run_batch(config)


if __name__ == "__main__":
    main()
