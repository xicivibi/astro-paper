"""Compare actual Excel observations and audit the deliverable, without Excel libraries."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent


def check_public_metadata(value):
    if isinstance(value, dict):
        if value.keys() & {'printer', 'cleanup', 'retired_instances'}:
            raise ValueError('Private metadata in public result; run sanitize_public.py')
        for item in value.values():
            check_public_metadata(item)
    elif isinstance(value, list):
        for item in value:
            check_public_metadata(item)


def read(path):
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if '\ufffd' in json.dumps(value, ensure_ascii=False):
        raise ValueError(f'U+FFFD in {path}; Unicode evidence is damaged')
    check_public_metadata(value)
    return value


def differences(a, b, path=""):
    if type(a) is not type(b):
        return [path + ": type differs"]
    if isinstance(a, dict):
        result = []
        for key in sorted(a.keys() | b.keys()):
            p = path + "/" + key
            if key not in a or key not in b:
                result.append(p + ": missing")
            else:
                result.extend(differences(a[key], b[key], p))
        return result
    if isinstance(a, list):
        if len(a) != len(b):
            return [path + ": length differs"]
        return [p for i, (x, y) in enumerate(zip(a, b))
                for p in differences(x, y, path+f"/{i}")]
    return [] if a == b else [path + ": value differs"]


def observation_payload(result):
    return {
        "steps": result["steps"],
        "wrong_result": result["wrong_result"],
        "fixed_result": result["fixed_result"],
        "reconciliation": result["reconciliation"],
        "observations_ko": result["observations_ko"],
        "excel_version": result["excel_version"],
        "excel_build": result["excel_build"],
        "ui_language": result["ui_language"],
        "environment": result["environment"],
        "assertions": result["assertions"],
        "expectations": result["expectations"],
        "differences_from_brief": result["differences_from_brief"],
        "not_verified": result["not_verified"],
        "screenshots": result["screenshots"],
    }


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument("first", nargs="?", default="first")
    parser.add_argument("second", nargs="?", default="second")
    args = parser.parse_args()
    manifest = read(ROOT / "manifest.json")
    for path in (ROOT / 'cases').glob('*/result.json'):
        read(path)
    records = []
    for slug in manifest:
        folder = ROOT / "cases" / slug
        errors = []
        try:
            a = read(ROOT / "runs" / args.first / (slug+".json"))
            b = read(ROOT / "runs" / args.second / (slug+".json"))
            delta = differences(observation_payload(a), observation_payload(b))
            spec = read(folder / "input.json")
            for name in ["input.json", "run.ps1", "build_input.ps1", "result.json", "input.xlsx", "evidence.xlsx", *spec["query_files"].values()]:
                if not (folder / name).is_file():
                    errors.append("Missing "+name)
            for result in (a, b):
                if result["status"] != "pass":
                    errors.append("Run status: "+result["status"])
                if result.get('cleanup_verified') is not True:
                    errors.append("Owned Excel cleanup / synthetic CSV restoration not verified")
                if not result["steps"] or not result["assertions"]:
                    errors.append("No observations/assertions")
                if any(not item["passed"] for item in result["assertions"]):
                    errors.append("Failed assertion")
                for name in ["input.json", "source.csv"]:
                    if (folder / name).exists():
                        actual = hashlib.sha256((folder / name).read_bytes()).hexdigest()
                        if result["input_sha256"].get(name) != actual:
                            errors.append("Deterministic fixture hash mismatch: "+name)
            if (folder / "input.xlsx").exists():
                actual = hashlib.sha256((folder / "input.xlsx").read_bytes()).hexdigest()
                if b["input_sha256"].get("input.xlsx") != actual:
                    errors.append("Final Excel input workbook hash mismatch")
            for name in ('before.png', 'after.png'):
                path = folder / name
                meta = next((item for item in b['screenshots'] if item['file'] == name), {})
                if not path.is_file():
                    errors.append('Missing '+name)
                    continue
                if not meta.get('valid') or not meta.get('pdf_text_checked'):
                    errors.append('Unvalidated '+name)
                if path.stat().st_size >= 300_000 or meta.get('sha256') != hashlib.sha256(path.read_bytes()).hexdigest():
                    errors.append('Oversized or stale '+name)
                with Image.open(path) as image:
                    colors = image.convert('RGB').getcolors(image.width * image.height)
                    if image.format != 'PNG' or not colors or len(colors) <= 1:
                        errors.append('Blank or invalid '+name)
                    if image.info.keys() - {'transparency', 'gamma', 'dpi', 'srgb', 'chromaticity'}:
                        errors.append('Unexpected PNG metadata '+name)
            canonical = json.dumps(observation_payload(b), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            record = dict(slug=slug, status="pass" if not errors and not delta else "fail",
                          observed_identical=not delta, differences=delta, errors=errors,
                          observation_sha256=hashlib.sha256(canonical.encode()).hexdigest())
        except (OSError, KeyError, ValueError) as exc:
            record = dict(slug=slug, status="fail", errors=[str(exc)], observed_identical=False)
        records.append(record)
    summaries = [read(ROOT / "runs" / label / "summary.json") for label in (args.first, args.second)]
    summary_errors = []
    for label, summary in zip((args.first, args.second), summaries):
        if not summary.get("complete") or summary.get("failed") or summary.get("passed") != len(manifest):
            summary_errors.append(label+": not a complete successful run-all")
        if any(c.get("exit_code") != 0 for c in summary["cases"]):
            summary_errors.append(label+": nonzero/missing child exit code")
    result = dict(first=args.first, second=args.second, cases=records, summary_errors=summary_errors,
                  all_observed_identical=all(r["observed_identical"] for r in records),
                  passed=sum(r["status"] == "pass" for r in records),
                  failed=sum(r["status"] != "pass" for r in records)+len(summary_errors),
                  compared="Full steps (including every observed field and exact formula/M), wrong_result, fixed_result, reconciliation, Korean observations, Excel version/build/language/environment, assertions, expectations, differences, not_verified and PNG validation metadata. Top-level run timestamps, xlsx container hashes and process identities are excluded; JSON/CSV fixture hashes are checked independently.")
    (ROOT / "repeatability.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return bool(result["failed"])


if __name__ == "__main__":
    raise SystemExit(main())
