"""Create only the deterministic, synthetic case definitions and thin entry points.

No Excel result is synthesized here. Run run-all.ps1 for actual observations.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASES = {}


def case(slug, columns, rows, queries=None, **extra):
    CASES[slug] = dict(synthetic=True, columns=columns, rows=rows,
                       queries=queries or {}, **extra)


source = 'Excel.CurrentWorkbook(){[Name="Input"]}[Content]'
months = [f"2026-{i:02}" for i in range(1, 13)]
case("power-query-unpivot-monthly-columns", ["ID", "Team", "Item"] + months,
     [[f"S{i}", f"Invented-{i%2}", f"Widget-{i}"] +
      [None if (i+j) % 5 == 0 else i*10+j for j in range(1, 13)]
      for i in range(1, 7)], {
         "query": f'let S={source} in Table.UnpivotOtherColumns(S,{{"ID","Team","Item"}},"Month","Amount")',
         "selected": f'let S={source} in Table.Unpivot(S,{{{", ".join(json.dumps(m) for m in months)}}},"Month","Amount")',
         "nulls": f'let S={source}, V=List.Combine(Table.ToColumns(Table.SelectColumns(S,List.Skip(Table.ColumnNames(S),3)))) in #table({{"Rows","MonthColumns","Nulls","NonNulls"}},{{{{Table.RowCount(S),Table.ColumnCount(S)-3,List.Count(V)-List.NonNullCount(V),List.NonNullCount(V)}}}})',
     }, added_month="2027-01", added_values=[101, 102, 103, 104, 105, 106])
case("power-query-split-column-delimiter", ["ID", "Parts"],
     [["S1", "A|B|C"], ["S2", "D|E"], ["S3", "F"],
      ["S4", "G|H, I|J"], ["S5", "K||M"]], {
         "query": f'let S={source} in Table.SplitColumn(S,"Parts",Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv),{{"P1","P2","P3"}})',
         "dynamic": f'let S={source}, N=List.Max(List.Transform(S[Parts], each List.Count(Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv)(_)))) in Table.SplitColumn(S,"Parts",Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv),List.Transform({{1..N}},each "P" & Text.From(_)),null,ExtraValues.Error)',
         "strict": f'let S={source}, T=Table.SplitColumn(S,"Parts",Splitter.SplitTextByDelimiter("|",QuoteStyle.Csv),{{"P1","P2","P3"}},null,ExtraValues.Error) in T',
     }, added_row=["S6", "N|O|P|Q"])
case("power-query-group-by-subtotal", ["Group", "Amount"],
     [["A", 10], ["A", None], ["A", 0], ["B", "20"], ["B", 5], ["C", 0], ["C", None]], {
         "query": f'let S={source} in Table.Group(S,{{"Group"}},{{{{"Sum", each List.Sum([Amount])}},{{"Rows",each Table.RowCount(_),Int64.Type}},{{"NonNulls",each List.NonNullCount([Amount]),Int64.Type}}}})',
         "fixed": f'let S=Table.TransformColumnTypes({source},{{{{"Amount",type number}}}},"en-US") in Table.Group(S,{{"Group"}},{{{{"Sum",each List.Sum([Amount]),type number}},{{"Rows",each Table.RowCount(_),Int64.Type}},{{"NonNulls",each List.NonNullCount([Amount]),Int64.Type}}}})',
         "errors": f'let S={source}, G=Table.Group(S,{{"Group"}},{{{{"Try",each try List.Sum([Amount])}}}}) in Table.ExpandRecordColumn(Table.AddColumn(G,"Message",each if [Try][HasError] then [Try][Error][Message] else null),"Try",{{"HasError"}},{{"HasError"}})',
     }, text_cells=["B5"])
case("power-query-fill-down-merged-cells", ["Group", "Item", "Note"],
     [["Invented-A", "S1", "Seed"], [None, "S2", None],
      ["Invented-B", "S3", ""], [None, "S4", None],
      ["Invented-C", "S5", "Next"], [None, "S6", None]], {
         "query": 'let S=Excel.Workbook(File.Contents("{{INPUT_XLSX}}"),null,true), D=S{[Item="Input",Kind="Sheet"]}[Data] in Table.PromoteHeaders(D,[PromoteAllScalars=true])',
         "fill": 'Table.FillDown(query,{"Group","Note"})',
         "empty_string": 'let S=Table.AddColumn(query,"LiteralEmpty",each if [Item]="S1" then "Seed" else if [Item]="S3" then "" else null,type text), F=Table.FillDown(S,{"Group","LiteralEmpty"}) in Table.AddColumn(F,"IsEmptyString",each [LiteralEmpty]="",type logical)',
         "fixed": 'let S=Table.AddColumn(query,"LiteralEmpty",each if [Item]="S1" then "Seed" else if [Item]="S3" then "" else null,type text), N=Table.ReplaceValue(S,"",null,Replacer.ReplaceValue,{"LiteralEmpty"}) in Table.FillDown(N,{"Group","LiteralEmpty"})',
     }, merges=["A2:A3", "A4:A5", "A6:A7"])
case("power-query-type-change-error-rows", ["Code", "Amount"],
     [["00101", "10"], ["00102", "bad"], ["00103", "0"], ["00104", None], ["00105", "12x"], ["00106", "25"]], {
         "query": f'Table.TransformColumnTypes({source},{{{{"Code",Int64.Type}},{{"Amount",type number}}}},"en-US")',
         "keep_errors": 'Table.SelectRowsWithErrors(query,{"Amount"})',
         "replace_errors": 'Table.ReplaceErrorValues(query,{{"Amount",null}})',
         "diagnostics": f'let S={source}, T=Table.AddColumn(S,"Attempt",each try Number.FromText([Amount],"en-US")), H=Table.AddColumn(T,"HasError",each [Attempt][HasError]), M=Table.AddColumn(H,"Message",each if [HasError] then [Attempt][Error][Message] else null) in Table.RemoveColumns(M,{{"Attempt"}})',
         "fixed": f'Table.ReplaceErrorValues(Table.TransformColumnTypes({source},{{{{"Code",type text}},{{"Amount",type number}}}},"en-US"),{{{{"Amount",null}}}})',
     }, all_text=True)
normalizer = 'Text.Trim(Text.Clean(Text.Replace(_,Character.FromNumber(160)," ")))'
case("power-query-merge-key-whitespace", ["ID", "Key"],
     [["S1", "ALPHA"], ["S2", "ALPHA "], ["S3", "BETA\u00a0"],
      ["S4", "ＧＡＭＭＡ"], ["S5", "delta"], ["S6", "OM\tEGA"], ["S7", "BETA"]], {
         "query": f'let S={source}, R=Excel.CurrentWorkbook(){{[Name="Lookup"]}}[Content], J=Table.NestedJoin(S,{{"Key"}},R,{{"Key"}},"Match",JoinKind.LeftOuter) in Table.AddColumn(Table.RemoveColumns(Table.AddColumn(J,"Matched",each Table.RowCount([Match])>0),{{"Match"}}),"Stage",each "raw")',
         "trim": f'let S=Table.TransformColumns({source},{{{{"Key",Text.Trim,type text}}}}), R=Excel.CurrentWorkbook(){{[Name="Lookup"]}}[Content], J=Table.NestedJoin(S,{{"Key"}},R,{{"Key"}},"Match",JoinKind.LeftOuter) in Table.RemoveColumns(Table.AddColumn(J,"Matched",each Table.RowCount([Match])>0),{{"Match"}})',
         "fixed": f'let S=Table.TransformColumns({source},{{{{"Key",each {normalizer},type text}}}}), R=Excel.CurrentWorkbook(){{[Name="Lookup"]}}[Content], J=Table.NestedJoin(S,{{"Key"}},R,{{"Key"}},"Match",JoinKind.LeftOuter) in Table.RemoveColumns(Table.AddColumn(J,"Matched",each Table.RowCount([Match])>0),{{"Match"}})',
         "diagnostics": f'let S={source}, T=Table.AddColumn(S,"Trim",each Text.Trim([Key])), C=Table.AddColumn(T,"Clean",each Text.Clean([Key])), N=Table.AddColumn(C,"Normalized",each {normalizer.replace("_", "[Key]")}) in N',
     }, lookup_columns=["Key", "Value"], lookup_rows=[["ALPHA", 1], ["BETA", 2], ["GAMMA", 3], ["DELTA", 4], ["OMEGA", 5]])
case("power-query-refresh-file-path-error", ["ID", "Amount"],
     [[f"S{i}", i*10] for i in range(1, 6)], {
         "query": 'let S=Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.Csv]) in Table.PromoteHeaders(S,[PromoteAllScalars=true])',
         "diagnostics": 'let T=try Binary.Length(Binary.Buffer(File.Contents("{{SOURCE_CSV}}"))) in #table({"HasError","Reason","Message","Detail"},{{T[HasError],if T[HasError] then T[Error][Reason] else null,if T[HasError] then T[Error][Message] else null,if T[HasError] then (try Text.From(T[Error][Detail]) otherwise Text.FromBinary(Json.FromValue(T[Error][Detail]),TextEncoding.Utf8)) else null}})',
         "fixed": 'let P=Excel.CurrentWorkbook(){[Name="SourcePath"]}[Content]{0}[Column1], S=Csv.Document(File.Contents(P),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.Csv]) in Table.PromoteHeaders(S,[PromoteAllScalars=true])',
     }, csv=True)
date_rows = [["S1", "03/04/2026"], ["S2", "25/04/2026"], ["S3", "04/03/2026"], ["S4", "12/11/2026"], ["S5", "31/02/2026"], ["S6", ""]]
csv_source = 'Table.PromoteHeaders(Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.Csv]),[PromoteAllScalars=true])'


def date_queries():
    q = {"query": csv_source}
    for locale, key in [("en-GB", "gb"), ("en-US", "us")]:
        q[key] = f'Table.TransformColumnTypes(query,{{{{"Date",type date}}}},"{locale}")'
        q[key+"_audit"] = f'''let S=Table.DuplicateColumn(query,"Date","Original"), T=Table.TransformColumnTypes(S,{{{{"Date",type date}}}},"{locale}"), A=Table.AddColumn(T,"Check",each let V=try [Date] in [HasError=V[HasError],ISO=if V[HasError] or V[Value]=null then null else Date.ToText(V[Value],"yyyy-MM-dd","en-US"),Message=if V[HasError] then V[Error][Message] else null]), R=Table.RemoveColumns(A,{{"Date"}}) in Table.ExpandRecordColumn(R,"Check",{{"HasError","ISO","Message"}})'''
    return q


case("csv-date-day-month-swap-checklist", ["ID", "Date"], date_rows, date_queries(), csv=True)
decimal_rows = [["S1", "1.234,56", "de-DE"], ["S2", "1,234.56", "en-US"], ["S3", "1.234", "de-DE"], ["S4", "1,234", "en-US"], ["S5", "1234,56", "de-DE"], ["S6", "1234.56", "en-US"]]
case("csv-decimal-thousands-separator", ["ID", "Number", "SourceLocale"], decimal_rows, {
    "query": csv_source,
    "fixed": 'Table.AddColumn(query,"Parsed",each Number.FromText([Number],[SourceLocale]),type number)',
    **{key: f'Table.TransformColumnTypes(query,{{{{"Number",type number}}}},"{locale}")' for key, locale in [("de", "de-DE"), ("us", "en-US")]},
    **{key+"_audit": f'''let S=query, A=Table.AddColumn(S,"Try",each let T=try Number.FromText([Number],"{locale}") in [HasError=T[HasError],Value=if T[HasError] then null else T[Value],Message=if T[HasError] then T[Error][Message] else null]) in Table.ExpandRecordColumn(A,"Try",{{"HasError","Value","Message"}})''' for key, locale in [("de", "de-DE"), ("us", "en-US")]},
}, csv=True, expected_numbers=[1234.56, 1234.56, 1234, 1234, 1234.56, 1234.56])
case("csv-quoted-newline-row-break", ["ID", "Note", "Amount"],
     [["S1", "first\r\nsecond", 10], ["S2", "plain", 20], ["S3", 'has "quotes", comma', 30], ["S4", "third\r\nfourth", 40], ["S5", "end", 50]], {
         "query": 'Table.PromoteHeaders(Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001]),[PromoteAllScalars=true])',
         "none": 'Table.PromoteHeaders(Csv.Document(File.Contents("{{SOURCE_CSV}}"),[Delimiter=",",Encoding=65001,QuoteStyle=QuoteStyle.None]),[PromoteAllScalars=true])',
     }, csv=True)
case("excel-text-stored-numbers-convert", ["ID", "Amount"],
     [["S1", "10"], ["S2", " 20 "], ["S3", "\u00a030\u00a0"], ["S4", "1\u00a0234"], ["S5", "0"], ["S6", "40"]], {
         "query": f'Table.TransformColumnTypes({source},{{{{"Amount",type number}}}},"en-US")',
         "fixed": f'let S=Table.TransformColumns({source},{{{{"Amount",each Text.Replace(Text.Trim(Text.Clean(_)),Character.FromNumber(160),""),type text}}}}) in Table.TransformColumnTypes(S,{{{{"Amount",type number}}}},"en-US")',
     }, all_text=True)
case("excel-duplicate-key-before-vlookup", ["ID", "Key", "Quantity"],
     [["S1", "A", 1], ["S2", "B", 2], ["S3", "C", 3], ["S4", "D", 1], ["S5", "E", 2]], {
         "query": 'let S=Excel.CurrentWorkbook(){[Name="Lookup"]}[Content], G=Table.Group(S,{"Key"},{{"Count",each Table.RowCount(_),Int64.Type},{"Minimum",each List.Min([Price]),type number},{"Maximum",each List.Max([Price]),type number}}) in Table.SelectRows(G,each [Count]>1)',
     }, lookup_columns=["Key", "Price"], lookup_rows=[["A", 10], ["B", 20], ["B", 200], ["C", 30], ["D", 40], ["E", 50]],
     approved_columns=["Key", "Price"], approved_rows=[["A", 10], ["B", 200], ["C", 30], ["D", 40], ["E", 50]])
case("excel-pdf-export-print-area-check", [f"Column{i:02}" for i in range(1, 19)],
     [[f"S{r}-C{c:02}" for c in range(1, 19)] for r in range(1, 7)])
case("csv-export-personal-data-column-check", ["ID", "FakeName", "FakeEmail", "FakePhone", "Amount"],
     [[f"S{i}", f"INVENTED PERSON {i}", f"fake{i}@example.invalid", f"000-0000-{i:04}", i*10] for i in range(1, 6)],
     hidden_columns=["B:D"], hidden_rows=[["INVENTED_HIDDEN_SHEET_ONLY", "not a real person"]])
published_rows = [["S1", "02/03/2026"], ["S2", "13/03/2026"], ["S3", "2026-03-13"], ["S4", "31/02/2026"], ["S5", ""], ["S6", "03/04/2026"]]
pq = date_queries()
pq["kept_errors"] = 'Table.SelectRowsWithErrors(gb,{"Date"})'
pq["replaced_errors"] = 'Table.ReplaceErrorValues(gb,{{"Date",null}})'
case("power-query-csv-date-using-locale", ["ID", "Date"], published_rows, pq, csv=True,
     published_post="src/content/posts/power-query-csv-date-using-locale.md")


def main():
    import csv
    import io
    for slug, spec in CASES.items():
        folder = ROOT / "cases" / slug
        folder.mkdir(parents=True, exist_ok=True)
        qs = spec.pop("queries")
        spec["query_files"] = {name: name+".m" for name in qs}
        (folder / "input.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        for name, m in qs.items():
            (folder / (name+".m")).write_text(m+"\n", encoding="utf-8")
        if spec.get("csv"):
            stream = io.StringIO(newline="")
            writer = csv.writer(stream, lineterminator="\r\n")
            writer.writerow(spec["columns"])
            writer.writerows(spec["rows"])
            (folder / "source.csv").write_bytes(stream.getvalue().encode("utf-8-sig"))
        (folder / "run.ps1").write_text(
            f'param([switch]$BuildOnly)\n& "$PSScriptRoot/../../runner.ps1" -Slug "{slug}" -BuildOnly:$BuildOnly\nexit $LASTEXITCODE\n', encoding="utf-8-sig")
        (folder / "build_input.ps1").write_text('& "$PSScriptRoot/run.ps1" -BuildOnly\nexit $LASTEXITCODE\n', encoding="utf-8-sig")
    (ROOT / "manifest.json").write_text(json.dumps(list(CASES), indent=2)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
