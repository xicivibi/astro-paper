function Set-After($Key) { $script:AfterSheet=$script:Handles[$Key].Sheet }
function Sheet-Sum($Sheet,$Address) { $wf=RC ($script:Excel.WorksheetFunction); return [double]$wf.Sum((Range $Sheet $Address)) }
function Data-Grid($Sheet) { return (Read-Grid $Sheet $Sheet.UsedRange) }

function Invoke-Procedure($Slug) {
    switch($Slug) {
        'power-query-unpivot-monthly-columns' {
            $all0=Q-Grid 'query';$sel0=Q-Grid 'selected';$n0=Q-Grid 'nulls'
            $sum0=Sheet-Sum $script:InputSheet 'D2:O7'
            $table=RC ($script:InputSheet.ListObjects.Item('Input'))
            (Cell $script:InputSheet 1 16).Value2=$script:Spec.added_month
            for($i=0;$i -lt $script:Spec.added_values.Count;$i++){(Cell $script:InputSheet ($i+2) 16).Value2=[double]$script:Spec.added_values[$i]}
            $table.Resize((Range $script:InputSheet 'A1:P7'))
            $a=Refresh-Q $script:Handles.query 'after_add_month_refresh_other_columns'
            $b=Refresh-Q $script:Handles.selected 'after_add_month_refresh_selected_columns'
            $n=Refresh-Q $script:Handles.nulls 'source_nulls_after_add_month'
            Assert-Lab ($null -eq $a.load_error -and $null -eq $b.load_error) 'Both queries refresh after extending the source table'
            $sum=Sheet-Sum $script:InputSheet 'D2:P7'
            $otherTotal=Total $a.table 'Amount';$selectedTotal=Total $b.table 'Amount'
            $script:Result.wrong_result=@{table=$b.table;sum=$selectedTotal}
            $script:Result.fixed_result=@{table=$a.table;sum=$otherTotal}
            $script:Result.reconciliation=@{source_before=$sum0;source_after=$sum;unpivot_before=(Total $all0 'Amount');selected_before=(Total $sel0 'Amount');unpivot_after=$otherTotal;selected_after=$selectedTotal;missing_amount=$sum-$selectedTotal;nulls_before=(Value-At $n0 0 'Nulls');nonnulls_before=(Value-At $n0 0 'NonNulls');source_after_diagnostics=$n.table}
            Assert-Lab ($otherTotal -eq $sum -and (Total $all0 'Amount') -eq $sum0) 'Unpivot totals reconcile to Excel SUM before and after'
            Expect-Lab ($a.table.row_count -gt $b.table.row_count -and $selectedTotal -eq $sum0) 'Selecting the original month columns misses the newly added month'
            Expect-Lab ($all0.row_count -eq (Value-At $n0 0 'NonNulls')) 'Null month cells are omitted by unpivot'
            Note ("월 추가 후 다른 열 피벗 해제는 {0}행·합계 {1}, 고정 월 선택은 {2}행·합계 {3}였다." -f $a.table.row_count,$otherTotal,$b.table.row_count,$selectedTotal)
            Note ("입력의 null {0}개는 피벗 해제 결과에 포함되지 않았다(추가 전 결과 {1}행)." -f (Value-At $n0 0 'Nulls'),$all0.row_count)
            Set-After 'query'
        }
        'power-query-split-column-delimiter' {
            $initial=Q-Grid 'query'
            $r=$script:Spec.rows.Count+2
            for($c=0;$c -lt 2;$c++){(Cell $script:InputSheet $r ($c+1)).Value2=[string]$script:Spec.added_row[$c]}
            $t=RC ($script:InputSheet.ListObjects.Item('Input'));$t.Resize((Range $script:InputSheet ('A1:B'+$r)))
            $later=Refresh-Q $script:Handles.query 'refresh_after_more_parts'
            $strict=Load-Q 'strict'
            $fixed=Q-Grid 'dynamic'
            $script:Result.wrong_result=$later
            $script:Result.fixed_result=$fixed
            $script:Result.reconciliation=@{initial=$initial;strict_extra_values_error=$strict;fixed_column_count=$later.table.columns.Count;dynamic_column_count=$fixed.columns.Count;comma_preserved=(Value-At $fixed 3 'P2')}
            Assert-Lab ($fixed.row_count -eq $r-1) 'Dynamic split preserves every input row'
            Assert-Lab ((Value-At $fixed ($fixed.row_count-1) 'P4') -eq $script:Spec.added_row[1].Split('|')[-1]) 'Dynamic split preserves the late extra part'
            Expect-Lab ($null -eq $later.load_error -and $later.table.columns.Count -lt $fixed.columns.Count) 'Fixed split silently omits the extra part by default'
            Assert-Lab ((Value-At $fixed 3 'P2') -eq 'H, I') 'A comma inside a pipe-delimited value remains in its part'
            Note ("고정 분할은 ID 포함 {0}열, 새 행을 반영한 동적 분할은 {1}열이었다. 쉼표가 있는 조각은 '{2}'로 남았다." -f $later.table.columns.Count,$fixed.columns.Count,(Value-At $fixed 3 'P2'))
            Set-After 'dynamic'
        }
        'power-query-group-by-subtotal' {
            $rawSum=Sheet-Sum $script:InputSheet 'B2:B8'
            $wrong=Load-Q 'query';$errors=Q-Grid 'errors';$fixed=Q-Grid 'fixed'
            $total=Total $fixed 'Sum';$rowTotal=Total $fixed 'Rows';$nonnulls=Total $fixed 'NonNulls'
            $script:Result.wrong_result=@{excel_sum_ignores_text=$rawSum;group_load=$wrong;group_diagnostics=$errors}
            $script:Result.fixed_result=$fixed
            $script:Result.reconciliation=@{raw_excel_sum=$rawSum;typed_group_total=$total;difference=$total-$rawSum;group_row_counts=$rowTotal;nonnull_counts=$nonnulls;source_rows=$script:Spec.rows.Count}
            Assert-Lab ($rowTotal -eq $script:Spec.rows.Count) 'Table.RowCount counts null and zero rows'
            Assert-Lab ($total -eq 35) 'Typed grouped sum includes the synthetic text number'
            Expect-Lab (@((Col $errors 'HasError')|Where-Object{$_ -eq $true}).Count -gt 0) 'List.Sum over text mixed with numbers creates an error'
            Note ("Excel 원본 SUM은 {0}, 숫자형 변환 후 그룹 합계는 {1}였다. 그룹 행 수 합계는 {2}, null 제외 개수는 {3}였다." -f $rawSum,$total,$rowTotal,$nonnulls)
            Set-After 'fixed'
        }
        'power-query-fill-down-merged-cells' {
            $raw=Q-Grid 'query';$fill=Q-Grid 'fill';$empty=Q-Grid 'empty_string';$fixed=Q-Grid 'fixed'
            $script:Result.wrong_result=@{xlsx_read=$raw;literal_empty_fill=$empty}
            $script:Result.fixed_result=@{merged_fill=$fill;empty_to_null_fill=$fixed}
            $blankGroups=@((Col $raw 'Group')|Where-Object{$null -eq $_}).Count
            $emptyFlags=@((Col $empty 'IsEmptyString')|Where-Object{$_ -eq $true}).Count
            $script:Result.reconciliation=@{source_rows=$raw.row_count;merged_blank_groups=$blankGroups;rows_after=$fixed.row_count;empty_string_rows_after_fill=$emptyFlags;formula_empty_xlsx_read=(Value-At $raw 2 'Note')}
            Assert-Lab ($raw.row_count -eq $fixed.row_count -and $blankGroups -gt 0) 'Excel.Workbook reads the actual merged workbook with null followers'
            Assert-Lab ((Value-At $fill 1 'Group') -eq (Value-At $fill 0 'Group')) 'FillDown fills a merged-cell follower'
            Expect-Lab ($emptyFlags -gt 0 -and (Value-At $fixed 2 'LiteralEmpty') -eq 'Seed') 'FillDown leaves literal empty strings; replacing them with null permits fill'
            Note ("병합 xlsx를 읽은 결과 그룹 null은 {0}개였다. M에서 만든 빈 문자열은 채우기 뒤에도 {1}행에 남았다." -f $blankGroups,$emptyFlags)
            Note ("xlsx의 빈 문자열 수식 셀을 읽은 값은 '{0}'였다. 리터럴 빈 문자열과의 차이는 별도 열로 검사했다." -f (Value-At $raw 2 'Note'))
            Set-After 'fixed'
        }
        'power-query-type-change-error-rows' {
            $wrong=Load-Q 'query';$keep=Load-Q 'keep_errors';$replace=Q-Grid 'replace_errors';$diag=Q-Grid 'diagnostics';$fixed=Q-Grid 'fixed'
            $count=@((Col $diag 'HasError')|Where-Object{$_ -eq $true}).Count
            $loadedErrors=if($wrong.table){$wrong.table.excel_error_cells.Count}else{$null}
            $script:Result.wrong_result=$wrong
            $script:Result.fixed_result=$fixed
            $script:Result.reconciliation=@{conversion_error_rows=$count;loaded_error_cells=$loadedErrors;keep_errors=$keep;replace_errors=$replace;diagnostics=$diag;original_code=(Value-At (Read-Grid $script:InputSheet 'A1:B7') 0 'Code');numeric_code=$(if($wrong.table){Value-At $wrong.table 0 'Code'});fixed_code=(Value-At $fixed 0 'Code');replaced_amount_total=(Total $fixed 'Amount')}
            Assert-Lab ($count -eq 2 -and $fixed.row_count -eq $script:Spec.rows.Count) 'Two invalid synthetic amounts are isolated without dropping rows'
            Assert-Lab ((Value-At $fixed 0 'Code') -ceq '00101') 'Text type preserves leading zeros'
            Expect-Lab ($null -eq $wrong.load_error -and $loadedErrors -eq $count) 'A query with cell errors loads and exposes Excel error cells'
            Note ("숫자 변환 오류는 {0}행, 로드된 오류 셀은 {1}개였다. 숫자형 코드는 '{2}', 텍스트형 코드는 '{3}'였다." -f $count,$loadedErrors,$script:Result.reconciliation.numeric_code,(Value-At $fixed 0 'Code'))
            Set-After 'fixed'
        }
        'power-query-merge-key-whitespace' {
            $raw=Q-Grid 'query';$trim=Q-Grid 'trim';$fixed=Q-Grid 'fixed';$diag=Q-Grid 'diagnostics'
            $a=Matches $raw;$b=Matches $trim;$c=Matches $fixed
            $script:Result.wrong_result=$raw;$script:Result.fixed_result=$fixed
            $unmatched=@();for($i=0;$i -lt $fixed.row_count;$i++){if(-not (Value-At $fixed $i 'Matched')){$unmatched+=,(Value-At $fixed $i 'ID')}}
            $script:Result.reconciliation=@{raw_matches=$a;trim_matches=$b;normalized_matches=$c;source_rows=$raw.row_count;unmatched_after_normalization=$unmatched;trim_only=$trim;normalization_diagnostics=$diag}
            Assert-Lab ($raw.row_count -eq $fixed.row_count -and $c -ge $a) 'Normalization preserves input rows and does not reduce matches'
            Expect-Lab (-not (Value-At $fixed 3 'Matched') -and -not (Value-At $fixed 4 'Matched')) 'Trim/Clean/NBSP replacement does not fix full-width characters or case'
            Expect-Lab ((Value-At $trim 2 'Matched')) 'Text.Trim already trims a trailing NBSP in this Excel build'
            Note ("병합 일치 수는 원본 {0}, Trim {1}, Trim/Clean/NBSP 치환 {2}였다. 최종 미일치 ID는 {3}였다." -f $a,$b,$c,($unmatched -join ', '))
            Set-After 'fixed'
        }
        'power-query-refresh-file-path-error' {
            $initial=Q-Grid 'query'
            $src=Join-Path $script:CaseDir 'source.csv';$moved=Join-Path $script:CaseDir 'moved-source.csv'
            $suspended=Suspend-WorkbookForFileMove
            $script:RestoreSource=@{source=$src;moved=$moved}
            try {
                for($attempt=0;$attempt -lt 25;$attempt++){
                    try{Move-Item -LiteralPath $src -Destination $moved -Force;break}catch{if($attempt -eq 24){throw};Start-Sleep -Milliseconds 200}
                }
                Resume-WorkbookAfterFileMove $suspended
                $qs=RC ($script:Book.Worksheets.Item('Q_query'))
                $lo=RC ($qs.ListObjects.Item(1));$qt=RC ($lo.QueryTable);$qt.BackgroundQuery=$false
                $script:Handles.query=@{Key='query';M=(Get-M 'query');Sheet=$qs;Table=$lo;QT=$qt}
                Add-Step 'file_move_after_closing_workbook' 'Workbook.SaveAs(before-file-move.xlsx); Close/Quit own instance; release COM; Move-Item own source.csv; new hidden instance reopens workbook without updating links' @{original_path_exists=(Test-Path -LiteralPath $src);moved_path_exists=(Test-Path -LiteralPath $moved);reopened_query_count=$script:Book.Queries.Count;initial_owned_instance_exited=(-not $script:Result.retired_instances[0].owned_process_remaining)}
                $wrong=Refresh-Q $script:Handles.query 'refresh_after_file_rename'
                $diag=Q-Grid 'diagnostics'
                $pathSheet=New-Sheet 'Path'
                (Range $pathSheet 'A1').Value2=$moved
                $null=RC ($script:Book.Names.Add('SourcePath',(Range $pathSheet 'A1')))
                $fixed=Q-Grid 'fixed'
                $script:Result.wrong_result=@{refresh=$wrong;m_error=$diag}
                $script:Result.fixed_result=$fixed
                $script:Result.reconciliation=@{initial_rows=$initial.row_count;fixed_rows=$fixed.row_count;source_path_named_cell=(Range $pathSheet 'A1').Value2;file_move_required_closing_source_workbook=$true}
                Assert-Lab ($initial.row_count -eq $fixed.row_count) 'Named-cell parameter reads all rows at the renamed location'
                Expect-Lab ($null -ne $wrong.load_error -and (Value-At $diag 0 'HasError')) 'Refreshing a missing absolute path fails'
                Note ("이름을 바꾼 뒤 절대 경로 새로 고침 오류: {0}" -f (Value-At $diag 0 'Message'))
                Note ("이름 정의 셀로 경로를 바꾼 뒤 {0}행을 로드했다." -f $fixed.row_count)
                Set-After 'fixed'
            } finally { # Outer runner restores the CSV after releasing Excel's file locks.
                [void]$script:Result.not_verified.Add('Excel held the CSV open even after closing the workbook; the owned Excel instance was quit and recreated around the file move. A rename while the first instance remained open was blocked by the OS.')
            }
        }
        {$_ -in @('csv-date-day-month-swap-checklist','power-query-csv-date-using-locale')} {
            $raw=Q-Grid 'query';$gbLoad=Load-Q 'gb';$usLoad=Load-Q 'us';$gb=Q-Grid 'gb_audit';$us=Q-Grid 'us_audit'
            $direct=Direct-CSV (Join-Path $script:CaseDir 'source.csv')
            Add-Step 'excel_direct_open' 'Workbooks.Open(source.csv, ReadOnly=true, Local=true)' $direct
            $gbErrors=@((Col $gb 'HasError')|Where-Object{$_ -eq $true}).Count
            $usErrors=@((Col $us 'HasError')|Where-Object{$_ -eq $true}).Count
            $swaps=@();for($i=0;$i -lt $gb.row_count;$i++){
                $g=Value-At $gb $i 'ISO';$u=Value-At $us $i 'ISO'
                if($null -ne $g -and $null -ne $u -and $g -cne $u){$swaps+=,@{id=(Value-At $gb $i 'ID');original=(Value-At $gb $i 'Original');gb=$g;us=$u}}
            }
            $script:Result.wrong_result=@{en_us=$us;load=$usLoad;direct_open=$direct}
            $script:Result.fixed_result=@{en_gb=$gb;load=$gbLoad}
            $script:Result.reconciliation=@{original=$raw;source_rows=$raw.row_count;gb_error_rows=$gbErrors;us_error_rows=$usErrors;silently_different_date_rows=$swaps;direct_open=$direct}
            Assert-Lab ($gb.row_count -eq $raw.row_count -and $us.row_count -eq $raw.row_count) 'Locale conversion audit retains every CSV record'
            Assert-Lab ($swaps.Count -gt 0) 'At least one valid date silently changes between US and GB interpretations'
            if($Slug -eq 'power-query-csv-date-using-locale'){
                $keep=Load-Q 'kept_errors';$rep=Q-Grid 'replaced_errors'
                $script:Result.reconciliation.kept_errors=$keep;$script:Result.reconciliation.replaced_errors=$rep
                $post=Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) $script:Spec.published_post
                $script:Result.input_sha256[$script:Spec.published_post]=(Get-FileHash -LiteralPath $post -Algorithm SHA256).Hash.ToLowerInvariant()
                [void]$script:Result.not_verified.Add('Published procedure reproduced through M equivalent of Using Locale; workbook-locale persistence across users and GUI automatic type detection were not exercised.')
                Expect-Lab ((Value-At $gb 0 'ISO') -eq '2026-03-02') 'Published 02/03/2026 example is March 2 with en-GB'
            } else {Expect-Lab ((Value-At $gb 0 'ISO') -eq '2026-04-03' -and (Value-At $us 0 'ISO') -eq '2026-03-04') '03/04/2026 swaps day and month between en-GB and en-US'}
            Note ("CSV {0}행 중 en-GB 오류 {1}행, en-US 오류 {2}행이었다. 두 로캘에서 모두 유효하지만 날짜가 달라진 행은 {3}개였다." -f $raw.row_count,$gbErrors,$usErrors,$swaps.Count)
            Note ("첫 행의 관측 날짜는 en-GB {0}, en-US {1}이었다. 직접 열기 결과는 셀 내부 값과 표시 값을 함께 보존했다." -f (Value-At $gb 0 'ISO'),(Value-At $us 0 'ISO'))
            Set-After 'gb_audit'
        }
        'csv-decimal-thousands-separator' {
            $raw=Q-Grid 'query';$deLoad=Load-Q 'de';$usLoad=Load-Q 'us';$de=Q-Grid 'de_audit';$us=Q-Grid 'us_audit'
            $fixed=Q-Grid 'fixed'
            $ratios=@();for($i=0;$i -lt $de.row_count;$i++){
                $d=Value-At $de $i 'Value';$u=Value-At $us $i 'Value'
                if($null -ne $d -and $null -ne $u -and $d -ne 0 -and $u -ne 0){$ratios+=,@{id=(Value-At $de $i 'ID');de=$d;us=$u;larger_over_smaller=([Math]::Max($d,$u)/[Math]::Min($d,$u))}}
            }
            $script:Result.wrong_result=@{en_us=$us;load=$usLoad}
            $script:Result.fixed_result=$fixed
            $script:Result.reconciliation=@{input=$raw;ratios=$ratios;de_total=(Total $de 'Value');us_total=(Total $us 'Value');per_source_locale_total=(Total $fixed 'Parsed');de_audit=$de;de_load=$deLoad;mixed_formats_require_per_source_locale=$true}
            Assert-Lab ($de.row_count -eq $raw.row_count -and $us.row_count -eq $raw.row_count) 'Both locale audits retain the mixed-format CSV rows'
            for($i=0;$i -lt $fixed.row_count;$i++){Assert-Lab ([Math]::Abs((Value-At $fixed $i 'Parsed')-$script:Spec.expected_numbers[$i]) -lt 0.0000001) ('Declared source locale recovers the authored intended number for '+(Value-At $fixed $i 'ID'))}
            $thousands=@($ratios|Where-Object{[Math]::Abs($_.larger_over_smaller-1000) -lt 0.00001})
            Expect-Lab ($thousands.Count -gt 0) 'A single-separator value differs by a factor of 1000'
            Note ("de-DE 합계는 {0}, en-US 합계는 {1}이었다. 두 해석의 비율이 1000인 행은 {2}개였다." -f (Total $de 'Value'),(Total $us 'Value'),$thousands.Count)
            Note ("합성 입력에 명시한 SourceLocale을 행마다 적용한 합계는 {0}이었다. 로캘 하나를 전체에 적용한 결과와 각 오류 메시지를 함께 보존했다." -f (Total $fixed 'Parsed'))
            Set-After 'fixed'
        }
        'csv-quoted-newline-row-break' {
            $default=Q-Grid 'query';$none=Q-Grid 'none';$direct=Direct-CSV (Join-Path $script:CaseDir 'source.csv')
            Add-Step 'excel_direct_open' 'Workbooks.Open(source.csv, ReadOnly=true, Local=true)' $direct
            $script:Result.wrong_result=$none;$script:Result.fixed_result=$default
            $script:Result.reconciliation=@{default_rows=$default.row_count;quote_style_none_rows=$none.row_count;direct_open_rows=$direct.row_count;direct_open=$direct;default_total=(Total $default 'Amount');source_records=$script:Spec.rows.Count}
            Assert-Lab ($default.row_count -eq $script:Spec.rows.Count) 'Csv.Document default preserves quoted multiline records'
            Expect-Lab ($none.row_count -gt $default.row_count -and $direct.row_count -eq $default.row_count) 'QuoteStyle.None splits embedded newlines while direct Excel open preserves records'
            Note ("기본 Csv.Document는 {0}행, QuoteStyle.None은 {1}행, Excel 직접 열기는 {2}행이었다." -f $default.row_count,$none.row_count,$direct.row_count)
            Set-After 'query'
        }
        'excel-text-stored-numbers-convert' {
            $rawSum=Sheet-Sum $script:InputSheet 'B2:B7'
            $conv=New-Sheet 'Conversions';$null=Write-Table $conv $script:Spec.columns $script:Spec.rows $null $true
            (Range $conv 'C1').Value2='VALUE';(Range $conv 'D1').Value2='DoubleUnary';(Range $conv 'E1').Value2='Normalized'
            for($r=2;$r -le 7;$r++){
                $null=Excel-Formula $conv ('C'+$r) ('=VALUE(B'+$r+')')
                $null=Excel-Formula $conv ('D'+$r) ('=--B'+$r)
                $null=Excel-Formula $conv ('E'+$r) ('=VALUE(SUBSTITUTE(TRIM(CLEAN(B'+$r+')),UNICHAR(160),""))')
            }
            $formulas=Read-Grid $conv 'A1:E7'
            $formulas.formulas=Read-Formulas $conv 'C2:E7'
            Add-Step 'worksheet_conversions' 'VALUE(Bn); --Bn; VALUE(SUBSTITUTE(TRIM(CLEAN(Bn)),UNICHAR(160),""))' $formulas
            $ttc=New-Sheet 'TextToColumns';$null=Write-Table $ttc @('ID','Amount') $script:Spec.rows $null $true
            $rg=Range $ttc 'B2:B7'
            $rg.TextToColumns($rg,1,1,$false,$false,$false,$false,$false,$false,[Type]::Missing,[Type]::Missing) | Out-Null
            $ttcGrid=Read-Grid $ttc 'A1:B7';$ttcSum=Sheet-Sum $ttc 'B2:B7'
            Add-Step 'text_to_columns_general' 'Range.TextToColumns(DataType=xlDelimited, TextQualifier=xlDoubleQuote, General field)' $ttcGrid
            $wrong=Load-Q 'query';$fixed=Q-Grid 'fixed';$real=Total $fixed 'Amount';$normalized=Sheet-Sum $conv 'E2:E7'
            $script:Result.wrong_result=@{sum_of_text=$rawSum;formulas=$formulas;power_query=$wrong;text_to_columns=$ttcGrid}
            $script:Result.fixed_result=$fixed
            $script:Result.reconciliation=@{raw_excel_sum=$rawSum;normalized_excel_sum=$normalized;power_query_normalized_sum=$real;text_to_columns_sum=$ttcSum;worksheet_error_cells=$formulas.excel_error_cells}
            Assert-Lab ($normalized -eq $real -and $real -eq 1334) 'Worksheet NBSP normalization agrees with Power Query and intended numeric total'
            Expect-Lab ($rawSum -eq 0 -and $formulas.excel_error_cells.Count -gt 0) 'SUM ignores text and direct VALUE/unary conversion fails on at least one NBSP value'
            Note ("텍스트 원본 SUM은 {0}, NBSP 정규화 후 Excel 합계와 Power Query 합계는 모두 {1}이었다. Text to Columns 합계는 {2}였다." -f $rawSum,$real,$ttcSum)
            Set-After 'fixed'
        }
        'excel-duplicate-key-before-vlookup' {
            $s=$script:InputSheet
            foreach($pair in @(@('D1','VLOOKUP'),@('E1','XLOOKUP'),@('F1','COUNTIF'),@('G1','ApprovedPrice'),@('H1','WrongAmount'),@('I1','ApprovedAmount'))){(Range $s $pair[0]).Value2=$pair[1]}
            for($r=2;$r -le 6;$r++){
                $null=Excel-Formula $s ('D'+$r) ('=VLOOKUP(B'+$r+',Lookup!$A$2:$B$7,2,FALSE)')
                try{(Range $s ('E'+$r)).Formula2=('=XLOOKUP(B'+$r+',Lookup!$A$2:$A$7,Lookup!$B$2:$B$7)')}catch{(Range $s ('E'+$r)).Formula=('=XLOOKUP(B'+$r+',Lookup!$A$2:$A$7,Lookup!$B$2:$B$7)')}
                $null=Excel-Formula $s ('F'+$r) ('=COUNTIF(Lookup!$A$2:$A$7,B'+$r+')')
                $null=Excel-Formula $s ('G'+$r) ('=VLOOKUP(B'+$r+',Approved!$A$2:$B$6,2,FALSE)')
                $null=Excel-Formula $s ('H'+$r) ('=C'+$r+'*D'+$r)
                $null=Excel-Formula $s ('I'+$r) ('=C'+$r+'*G'+$r)
            }
            $g=Read-Grid $s 'A1:I6';$g.formulas=Read-Formulas $s 'D2:I6';$dups=Q-Grid 'query';$wrong=Sheet-Sum $s 'H2:H6';$fixed=Sheet-Sum $s 'I2:I6'
            Add-Step 'lookup_and_duplicate_check' 'VLOOKUP exact match; XLOOKUP default; COUNTIF; approved unique lookup; quantity * price' $g
            $script:Result.wrong_result=@{total=$wrong;lookups=$g}
            $script:Result.fixed_result=@{total=$fixed;approved_unique_rows=(Data-Grid $script:ApprovedSheet);duplicate_groups=$dups}
            $script:Result.reconciliation=@{wrong_total=$wrong;approved_total=$fixed;understatement=$fixed-$wrong;duplicated_keys=$dups.row_count;policy='The synthetic Approved table explicitly chooses price 200 for B; first/last alone is not a business correction.'}
            Assert-Lab ((Value-At $g 1 'VLOOKUP') -eq 20 -and (Value-At $g 1 'COUNTIF') -eq 2 -and $dups.row_count -eq 1) 'VLOOKUP returns the first duplicate and both duplicate checks detect B'
            Expect-Lab ((Value-At $g 1 'XLOOKUP') -eq (Value-At $g 1 'VLOOKUP')) 'XLOOKUP defaults to the same first duplicate'
            Assert-Lab ($fixed-$wrong -eq 360) 'Approved price reconciliation quantifies the synthetic understatement'
            Note ("중복 키의 VLOOKUP은 {0}, XLOOKUP은 {1}, COUNTIF는 {2}였다. 첫 일치 기준 합계 {3}과 승인된 고유 키 기준 합계 {4}의 차이는 {5}였다." -f (Value-At $g 1 'VLOOKUP'),(Value-At $g 1 'XLOOKUP'),(Value-At $g 1 'COUNTIF'),$wrong,$fixed,($fixed-$wrong))
            $script:AfterSheet=$s
        }
        'excel-pdf-export-print-area-check' { Invoke-PdfCase }
        'csv-export-personal-data-column-check' { Invoke-PrivacyCase }
        default {throw "No procedure for $Slug"}
    }
}

function Pdf-Export($Sheet,$File,$IgnorePrintAreas=$false) {
    $path=Join-Path $script:CaseDir $File
    $Sheet.ExportAsFixedFormat(0,$path,0,$true,$IgnorePrintAreas) | Out-Null
    $raw=[Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($path))
    $pages=[regex]::Matches($raw,'/Type\s*/Page\b').Count
    $ps=RC ($Sheet.PageSetup)
    $h=RC ($Sheet.HPageBreaks);$v=RC ($Sheet.VPageBreaks)
    return [ordered]@{file=$File;page_count=$pages;vertical_page_breaks=$v.Count;horizontal_page_breaks=$h.Count;columns_split=($v.Count -gt 0);print_area=$ps.PrintArea;zoom=$ps.Zoom;fit_wide=$ps.FitToPagesWide;fit_tall=$ps.FitToPagesTall;ignore_print_areas=$IgnorePrintAreas}
}

function Invoke-PdfCase {
    $s=$script:InputSheet;$ps=RC ($s.PageSetup)
    (Range $s 'A:R').ColumnWidth=18
    $ps.PaperSize=9;$ps.Orientation=1;$ps.Zoom=100;$ps.FitToPagesWide=$false;$ps.FitToPagesTall=$false
    $ps.PrintArea='$A$1:$F$7'
    $area=Pdf-Export $s 'with-print-area.pdf'
    $ps.PrintArea=''
    $none=Pdf-Export $s 'without-print-area.pdf'
    $ps.PrintArea='$A$1:$R$7';$ps.Zoom=$false;$ps.FitToPagesWide=1;$ps.FitToPagesTall=$false
    $fit=Pdf-Export $s 'fit-one-page-wide.pdf'
    Add-Step 'print_area_pdf' 'PageSetup.PrintArea=A1:F7; Zoom=100; Worksheet.ExportAsFixedFormat(xlTypePDF)' $area
    Add-Step 'no_print_area_pdf' 'PageSetup.PrintArea=""; Zoom=100; Worksheet.ExportAsFixedFormat(xlTypePDF)' $none
    Add-Step 'fit_width_pdf' 'PageSetup.PrintArea=A1:R7; Zoom=false; FitToPagesWide=1; FitToPagesTall=false; ExportAsFixedFormat' $fit
    $script:Result.wrong_result=@{partial_print_area=$area;no_print_area=$none};$script:Result.fixed_result=$fit
    $script:Result.reconciliation=@{input_columns=$script:Spec.columns.Count;print_area_pdf=$area;no_print_area_pdf=$none;fit_width_pdf=$fit;page_count_method='ASCII /Type\\s*/Page\\b; page-break counts also read from Excel after export'}
    Assert-Lab ($area.page_count -gt 0 -and $none.page_count -gt 0 -and $fit.page_count -gt 0) 'All three native Excel PDF exports contain page objects'
    Expect-Lab ($none.page_count -gt $fit.page_count -and $fit.page_count -eq 1 -and $none.columns_split -and -not $fit.columns_split) 'A wide sheet splits columns without fitting; FitToPagesWide=1 removes the split'
    Note ("PDF 페이지 수는 부분 인쇄 영역 {0}, 인쇄 영역 없음 {1}, 너비 맞춤 {2}였다. Excel 세로 페이지 나누기는 각각 {3}, {4}, {5}개였다." -f $area.page_count,$none.page_count,$fit.page_count,$area.vertical_page_breaks,$none.vertical_page_breaks,$fit.vertical_page_breaks)
    [void]$script:Result.not_verified.Add('Physical printer output, PDF text extraction and visual readability at the resulting scale were not verified; column splitting is based on Excel page breaks and PDF page-object counts.')
    $script:AfterSheet=$s
}

function Invoke-PrivacyCase {
    $s=$script:InputSheet
    foreach($address in $script:Spec.hidden_columns){(Range $s $address).EntireColumn.Hidden=$true}
    $hidden=New-Sheet 'HiddenSynthetic';$null=Write-Table $hidden @('Marker','Note') $script:Spec.hidden_rows $null
    $s.Activate()|Out-Null;$hidden.Visible=0
    $csv=Join-Path $script:CaseDir 'full-export.csv'
    $script:Book.SaveAs($csv,62)
    $script:Book.SaveAs((Join-Path $script:CaseDir 'working-export.xlsx'),51)
    $bytes=[IO.File]::ReadAllBytes($csv);$text=[Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xfeff)
    $parsed=@(ConvertFrom-Csv -InputObject $text -Delimiter ([char]$script:Excel.International(5)))
    $direct=Direct-CSV $csv
    $included=@();foreach($name in $script:Spec.columns){if($text.Contains($name)){$included+=,$name}}
    $hiddenMarker=[string]$script:Spec.hidden_rows[0][0]
    $safe=New-Sheet 'SafeExport';$safeRows=@()
    for($i=2;$i -le $script:Spec.rows.Count+1;$i++){$safeRows+=,@((Cell $s $i 1).Value2,(Cell $s $i 5).Value2)}
    $null=Write-Table $safe @('ID','Amount') $safeRows $null
    $safe.Activate()|Out-Null
    $safePath=Join-Path $script:CaseDir 'allowlist-export.csv'
    $script:Book.SaveAs($safePath,62)
    $script:Book.SaveAs((Join-Path $script:CaseDir 'working-export.xlsx'),51)
    $safeText=[Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($safePath)).TrimStart([char]0xfeff)
    $safeRead=Direct-CSV $safePath
    $export=[ordered]@{raw_csv=$text;columns_in_csv=$included;csv_records=$parsed.Count;direct_open=$direct;hidden_sheet_marker_written=$text.Contains($hiddenMarker);hidden_column_value_written=$text.Contains([string]$script:Spec.rows[0][2]);hidden_sheet_visible_state=$hidden.Visible;exported_sheet=$s.Name}
    $safeExport=[ordered]@{raw_csv=$safeText;direct_open=$safeRead;fake_email_present=$safeText.Contains([string]$script:Spec.rows[0][2]);hidden_sheet_marker_written=$safeText.Contains($hiddenMarker)}
    Add-Step 'csv_export_hidden_columns' 'Input.Columns(B:D).Hidden=true; other worksheet.Visible=xlSheetHidden; Input.Activate; Workbook.SaveAs(xlCSVUTF8)' $export
    Add-Step 'csv_export_allowlist' 'Copy ID and Amount only to a dedicated sheet; activate it; Workbook.SaveAs(xlCSVUTF8)' $safeExport
    $script:Result.wrong_result=$export;$script:Result.fixed_result=$safeExport
    $script:Result.reconciliation=@{full_export_rows=$direct.row_count;safe_export_rows=$safeRead.row_count;full_export_columns=$direct.columns.Count;safe_export_columns=$safeRead.columns.Count;full_amount_total=(Total $direct 'Amount');safe_amount_total=(Total $safeRead 'Amount');invented_only=$true}
    Assert-Lab ($direct.row_count -eq $safeRead.row_count -and $safeRead.columns.Count -eq 2) 'Allowlist export retains all synthetic records with only approved columns'
    Assert-Lab ((Total $direct 'Amount') -eq (Total $safeRead 'Amount')) 'Allowlist CSV reconciles to the full CSV amount total'
    Expect-Lab ($export.hidden_column_value_written -and -not $export.hidden_sheet_marker_written) 'Hidden columns are exported; the hidden nonactive worksheet is not exported'
    Assert-Lab (-not $safeExport.fake_email_present) 'The allowlist CSV excludes synthetic personal-looking values'
    Note ("숨긴 열을 포함한 CSV는 {0}열·{1}행이었고 숨긴 열 값 포함 여부는 {2}, 숨긴 시트 표식 포함 여부는 {3}였다. 허용 열 전용 CSV는 {4}열이었다." -f $direct.columns.Count,$direct.row_count,$export.hidden_column_value_written,$export.hidden_sheet_marker_written,$safeRead.columns.Count)
    $script:AfterSheet=$safe
}
