param([Parameter(Mandatory=$true)][string]$Slug,[switch]$BuildOnly)
. "$PSScriptRoot/common.ps1"
. "$PSScriptRoot/procedures.ps1"
$script:CaseDir=Join-Path $PSScriptRoot ('cases/'+$Slug)
if(-not (Test-Path -LiteralPath (Join-Path $script:CaseDir 'input.json'))){throw "Unknown case $Slug"}
$script:Spec=Get-Content -Raw -Encoding UTF8 (Join-Path $script:CaseDir 'input.json') | ConvertFrom-Json
$script:ComObjects=New-Object Collections.ArrayList
$script:Handles=@{}
$script:QueryCount=0
$script:Excel=$null;$script:Book=$null;$excelPid=0;$excelStart=$null
$script:OwnsExcel=$false
$script:Result=[ordered]@{
    slug=$Slug;excel_version=$null;excel_build=$null;ui_language=$null;run_at=[DateTime]::UtcNow.ToString('o')
    input_sha256=[ordered]@{};steps=(New-Object Collections.ArrayList)
    wrong_result=$null;fixed_result=$null;reconciliation=$null
    observations_ko=(New-Object Collections.ArrayList)
    not_verified=(New-Object Collections.ArrayList)
    differences_from_brief=(New-Object Collections.ArrayList)
    assertions=(New-Object Collections.ArrayList);expectations=(New-Object Collections.ArrayList)
    screenshots=(New-Object Collections.ArrayList);status='fail';failure=$null;cleanup=$null
}
$beforePids=@(Get-Process EXCEL -ErrorAction SilentlyContinue | ForEach-Object {$_.Id})
try {
    $script:Excel=RC (New-Object -ComObject Excel.Application)
    [uint32]$nativePid=0
    [void][ExcelLab.Native]::GetWindowThreadProcessId([IntPtr]$script:Excel.Hwnd,[ref]$nativePid)
    $excelPid=[int]$nativePid
    if($beforePids -contains $excelPid){throw 'Safety gate: COM returned a pre-existing Excel PID'}
    $script:OwnsExcel=$true
    $script:Excel.Visible=$false
    $script:Excel.DisplayAlerts=$false
    $script:Excel.AskToUpdateLinks=$false
    $script:Excel.AutomationSecurity=3
    $excelStart=(Get-Process -Id $excelPid).StartTime.ToUniversalTime().ToString('o')
    Write-Json (Join-Path $script:CaseDir 'owned-process.json') @{pid=$excelPid;start_time=$excelStart;runner_pid=$PID}
    $script:Result.excel_version=[string]$script:Excel.Version
    $script:Result.excel_build=[string]$script:Excel.Build
    $script:Result.ui_language=[ordered]@{lcid=$script:Excel.LanguageSettings.LanguageID(2);culture=[Globalization.CultureInfo]::GetCultureInfo($script:Excel.LanguageSettings.LanguageID(2)).Name}
    $script:Result.environment=[ordered]@{os_culture=[Globalization.CultureInfo]::CurrentCulture.Name;excel_decimal_separator=$script:Excel.International(3);excel_thousands_separator=$script:Excel.International(4);excel_date_order=$script:Excel.International(32);excel_list_separator=$script:Excel.International(5);printer=$script:Excel.ActivePrinter;synthetic=$true}
    $books=RC ($script:Excel.Workbooks)
    $script:Book=RC ($books.Add(-4167))
    $script:InputSheet=RC ($script:Book.Worksheets.Item(1))
    $script:InputSheet.Name='Input'
    $script:InputSheet.Cells.Font.Name='Hanjin Group Sans'
    $script:InputRange=Write-Table $script:InputSheet $script:Spec.columns $script:Spec.rows $(if($script:Spec.merges){$null}else{'Input'}) ([bool]$script:Spec.all_text)
    if($script:Spec.merges){foreach($m in $script:Spec.merges){(Range $script:InputSheet $m).Merge() | Out-Null};(Range $script:InputSheet 'C4').NumberFormat='0';(Range $script:InputSheet 'C4').Formula='=""';$script:Excel.Calculate()}
    if($script:Spec.lookup_rows){$script:LookupSheet=New-Sheet 'Lookup';$null=Write-Table $script:LookupSheet $script:Spec.lookup_columns $script:Spec.lookup_rows 'Lookup'}
    if($script:Spec.approved_rows){$script:ApprovedSheet=New-Sheet 'Approved';$null=Write-Table $script:ApprovedSheet $script:Spec.approved_columns $script:Spec.approved_rows 'Approved'}
    $script:Book.SaveAs((Join-Path $script:CaseDir 'input.xlsx'),51)
    foreach($f in @('input.json','input.xlsx','source.csv')){ $p=Join-Path $script:CaseDir $f;if(Test-Path -LiteralPath $p){$script:Result.input_sha256[$f]=Shared-FileHash $p} }
    if($BuildOnly){$script:Result.status='built'} else {
        Add-Step 'input_readback' 'Worksheet.UsedRange.Value2/Text (synthetic fixture)' (Read-Grid $script:InputSheet $script:InputRange)
        Invoke-Procedure $Slug
        $wrongQueries=@{
            'power-query-unpivot-monthly-columns'='selected';'power-query-split-column-delimiter'='query'
            'power-query-group-by-subtotal'='query';'power-query-fill-down-merged-cells'='query'
            'power-query-type-change-error-rows'='query';'power-query-merge-key-whitespace'='query'
            'power-query-refresh-file-path-error'='diagnostics';'csv-date-day-month-swap-checklist'='us_audit'
            'power-query-csv-date-using-locale'='us_audit';'csv-decimal-thousands-separator'='us_audit'
            'csv-quoted-newline-row-break'='none';'excel-text-stored-numbers-convert'='query'
        }
        if($Slug -eq 'excel-pdf-export-print-area-check'){
            Screenshot-Pdf (Join-Path $script:CaseDir 'with-print-area.pdf') 'before' 'Input' '$A$1:$F$7'
            Screenshot-Pdf (Join-Path $script:CaseDir 'fit-one-page-wide.pdf') 'after' 'Input' '$A$1:$R$7'
        } else {
            $wrongSheet=$script:InputSheet
            if($wrongQueries.ContainsKey($Slug)){$wrongSheet=$script:Handles[$wrongQueries[$Slug]].Sheet}
            $wrongRange=$wrongSheet.UsedRange
            if($Slug -eq 'power-query-refresh-file-path-error'){$wrongRange=Range $wrongSheet 'A1:B2'}
            if($Slug -eq 'excel-duplicate-key-before-vlookup'){$wrongRange=Range $wrongSheet 'A1:F6'}
            if($Slug -eq 'excel-text-stored-numbers-convert'){
                $wrongSheet=RC ($script:Book.Worksheets.Item('Conversions'))
                (Range $wrongSheet 'A9').Value2='SUM of text'
                $null=Excel-Formula $wrongSheet 'B9' '=SUM(B2:B7)'
                $wrongRange=Range $wrongSheet 'A1:D9'
            }
            if($Slug -eq 'csv-export-personal-data-column-check'){
                (Range $wrongSheet 'B:D').EntireColumn.Hidden=$false
                try{Screenshot $wrongSheet $wrongRange 'before'}finally{(Range $wrongSheet 'B:D').EntireColumn.Hidden=$true}
            } else {Screenshot $wrongSheet $wrongRange 'before'}
            if($Slug -eq 'excel-duplicate-key-before-vlookup'){
                $approvedView=New-Sheet 'ApprovedResult'
                $null=Write-Table $approvedView @('ID','Key','Quantity','ApprovedPrice','ApprovedAmount') @() $null
                for($row=2;$row -le 6;$row++){
                    $col=1
                    foreach($source in @('A','B','C','G','I')){
                        (RC ($approvedView.Cells.Item($row,$col))).Formula=('=Input!'+$source+$row)
                        $col++
                    }
                }
                $script:Excel.Calculate()
                Screenshot $approvedView 'A1:E6' 'after'
            } else {Screenshot $script:AfterSheet $script:AfterSheet.UsedRange 'after'}
        }
        Assert-Lab ($script:Result.screenshots.Count -eq 2) 'Two nonblank private-data-free native Excel PNGs recorded'
        $script:Result.query_refresh_attempts=$script:QueryCount
        [void]$script:Result.not_verified.Add('COM/API execution does not verify the exact Korean ribbon click path, other Excel builds, other OS locales, or human review of the post.')
        $script:Book.SaveAs((Join-Path $script:CaseDir 'evidence.xlsx'),51)
        $script:Result.status='pass'
    }
} catch {
    $script:Result.failure=Error-Info $_
    $script:Result.failure.script_stack_trace=$_.ScriptStackTrace
    [void]$script:Result.not_verified.Add('Case stopped at the recorded failure; subsequent steps were not verified.')
} finally {
    # Close only our workbook and our application. Never attach to an active instance.
    if($script:Book){try{$script:Book.Close($false)}catch{}}
    if($script:Excel -and $script:OwnsExcel -and $excelPid -ne 0 -and $beforePids -notcontains $excelPid){try{$script:Excel.Quit()}catch{}}
    for($i=$script:ComObjects.Count-1;$i -ge 0;$i--){try{if([Runtime.InteropServices.Marshal]::IsComObject($script:ComObjects[$i])){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($script:ComObjects[$i])}}catch{}}
    $script:ComObjects.Clear();$script:Handles.Clear();$script:Book=$null;$script:Excel=$null
    [GC]::Collect();[GC]::WaitForPendingFinalizers();[GC]::Collect();[GC]::WaitForPendingFinalizers()
    $forced=$false
    if($script:OwnsExcel -and $excelPid -gt 0 -and $beforePids -notcontains $excelPid){
        for($i=0;$i -lt 30;$i++){if(-not (Get-Process -Id $excelPid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 200}
        $proc=Get-Process -Id $excelPid -ErrorAction SilentlyContinue
        if($proc -and $proc.StartTime.ToUniversalTime().ToString('o') -eq $excelStart){Stop-Process -Id $excelPid -Force;$forced=$true;Start-Sleep -Milliseconds 300}
    }
    $alive=[bool](Get-Process -Id $excelPid -ErrorAction SilentlyContinue)
    $script:Result.cleanup=[ordered]@{owned_pid=$excelPid;owned_start_time=$excelStart;forced_owned_pid_only=$forced;owned_process_remaining=$alive;preexisting_pids=$beforePids}
    if($script:RestoreSource){
        try{
            if(Test-Path -LiteralPath $script:RestoreSource.moved){Move-Item -LiteralPath $script:RestoreSource.moved -Destination $script:RestoreSource.source -Force}
            $restored=(Test-Path -LiteralPath $script:RestoreSource.source) -and -not (Test-Path -LiteralPath $script:RestoreSource.moved)
            $script:Result.cleanup.source_csv_restored=$restored
            if(-not $restored){throw 'Synthetic CSV path restoration not confirmed'}
        }catch{$script:Result.status='fail';$script:Result.failure=Error-Info $_}
    }
    if($alive){$script:Result.status='fail';$script:Result.not_verified.Add('Owned Excel process cleanup was not confirmed') | Out-Null}
    Write-Json (Join-Path $script:CaseDir 'result.json') $script:Result
}
Write-Output ($Slug+': '+$script:Result.status+$(if($script:Result.failure){' '+$script:Result.failure.message}))
if($script:Result.status -eq 'fail'){exit 1}else{exit 0}
