"""Record a single Git-backed rebuild request for one stale lifecycle state."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re


def mark(path: Path, fingerprint: str, *, now: datetime) -> bool:
    if not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise ValueError("invalid lifecycle fingerprint")
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("lifecycle request time must have a timezone")
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
        if existing.get("fingerprint") == fingerprint:
            return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "fingerprint": fingerprint,
        "requestedAt": now.astimezone(timezone.utc).isoformat(),
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fingerprint", required=True)
    parser.add_argument("--state", type=Path, required=True)
    args = parser.parse_args()
    if not mark(args.state, args.fingerprint, now=datetime.now(timezone.utc)):
        raise SystemExit("rebuild already requested for this stale lifecycle state")


if __name__ == "__main__":
    main()
