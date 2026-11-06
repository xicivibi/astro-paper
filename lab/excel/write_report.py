"""Render a human-readable index from saved real-run evidence (no measurements)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    summary = read(ROOT / "summary.json")
    repeat = read(ROOT / "repeatability.json")
    process = read(ROOT / "process-verification.json")
    slugs = read(ROOT / "manifest.json")
    results = [read(ROOT / "cases" / slug / "result.json") for slug in slugs]
    lines = ["# 실제 Excel 재현 결과", "",
             f"Excel {results[0]['excel_version']} / build {results[0]['excel_build']} / "
             f"UI {results[0]['ui_language']['culture']}. 모든 입력은 합성 데이터다.", "",
             f"최종 run-all: {summary['passed']} 통과, {summary['failed']} 실패. "
             f"재실행 비교: {repeat['passed']} 통과, {repeat['failed']} 실패. "
             f"관측값 전체 동일: {repeat['all_observed_identical']}. "
             f"남은 자체 Excel 프로세스: {process['remaining_owned_count']}개.", "",
             "| 사례 | 상태 | 관측 결과 |", "| --- | --- | --- |"]
    for r in results:
        description = " ".join(r["observations_ko"]).replace("|", "\\|").replace("\n", " ")
        if r["slug"] in ("csv-date-day-month-swap-checklist", "power-query-csv-date-using-locale"):
            audit = r["reconciliation"]["direct_open"]["date_audit"]
            ix = audit["columns"].index("IsNumber")
            numeric = sum(row[ix] is True for row in audit["rows"])
            description += f" 직접 열기의 날짜 숫자 셀은 {numeric}개였다(빈 셀 포함 {audit['row_count']}행 검사)."
        lines.append(f"| [{r['slug']}](cases/{r['slug']}/result.json) | {r['status']} | {description} |")
    lines += ["", "## 예상과 다른 점 / 실행 제약", ""]
    for r in results:
        for item in r["differences_from_brief"]:
            lines.append(f"- `{r['slug']}`: 기대와 달랐음 — {item}")
    path_result = next(r for r in results if r["slug"] == "power-query-refresh-file-path-error")
    err = path_result["wrong_result"]["refresh"]["load_error"]
    codes = [e.get("error_code") for e in err["exception_chain"] if "error_code" in e]
    lines += [f"- 경로 오류의 실제 COM error code: `{codes}`. 원문 메시지는 해당 result.json에 보존했다.",
              "- 경로 사례에서는 첫 로드 후 파일 잠금이 남아 자체 Excel을 종료하고 파일 이름을 바꾼 뒤 새 숨김 인스턴스로 같은 쿼리를 재개했다. 실행 뒤 CSV 경로를 복원했다."]
    images = sum(len(r["screenshots"]) for r in results)
    skipped = [n for r in results for n in r["not_verified"] if " PNG:" in n]
    methods = sorted({image["method"] for r in results for image in r["screenshots"]})
    lines += [f"- 검증된 PNG: {images}개. 실패/빈 이미지로 제외한 캡처: {len(skipped)}건. 실제 캡처 방식: {', '.join(methods)}.",
              "- 클립보드 보존 사전 검사가 실패해 CopyPicture 두 방식은 실행하지 않았다. 사용자 클립보드와 데스크톱 화면은 변경·캡처하지 않았다. 상세 비교·정확한 오류 메시지·이미지는 [GAPS.md](GAPS.md)에 있다.",
              "- 정확한 한국어 리본 클릭 경로, GUI 자동 자료형 감지, 다른 Excel 빌드·OS 로캘, 인쇄물, PDF 축소 후 가독성, 사람의 원고 검토는 검증하지 않았다.",
              "- M 오류가 워크시트에서 어떻게 로드됐는지는 셀 내부 값·표시 값과 M 오류 진단을 함께 읽어 기록했다. 오류 셀로 나타나지 않은 결과도 그대로 보존했다.", "",
              "## 파일", "",
              "- `run-all.ps1`: 전체 실행, 실패 후 계속 진행, summary 기록.",
              "- `runner.ps1`, `common.ps1`, `procedures.ps1`: 자체 인스턴스 수명 관리 및 실제 실험.",
              "- `cases/<slug>/input.json`, `build_input.ps1`, `run.ps1`, `input.xlsx`, `evidence.xlsx`, `result.json`; Power Query 사례에는 `query.m`와 비교 쿼리. CSV/PDF 사례에는 실제 입출력 파일.",
              f"- `runs/{repeat['first']}/`, `runs/{repeat['second']}/`: 관측값을 비교한 두 실제 전체 실행의 원본 JSON과 stdout/stderr. `runs/development/`와 그 밖의 이전 실행은 개발·진단 기록이다.",
              "- `summary.json`, `repeatability.json`, `process-verification.json`: 최종 상태·값 비교·프로세스 종료 증거.",
              "- `verify_runs.py`, `verify_processes.ps1`, `write_report.py`, `prepare_lab.py`, `README.md`: 재검증·종료 확인·보고서·입력 생성·사용법 및 도구 선정 근거.",
              "- 전체 경로 목록: [file-list.txt](file-list.txt).", "",
              "추가 설치·계정 연결·외부 모델 호출·커밋·push·배포는 수행하지 않았다. "
              "새 파일은 lab/excel 안에만 작성했다. 기존 글·초안·pending 자료는 수정하지 않았다.", ""]
    (ROOT / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    paths = sorted({p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file()} | {"file-list.txt"})
    (ROOT / "file-list.txt").write_text("\n".join(paths)+"\n", encoding="utf-8")
    print(f"Wrote REPORT.md and file-list.txt ({len(paths)} files)")


if __name__ == "__main__":
    main()
