$ErrorActionPreference = 'Stop'
# Native child output and Python pipes must agree on UTF-8, independently of ACP 949.
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
$env:PYTHONIOENCODING = 'utf-8'
Add-Type -AssemblyName System.Drawing
if (-not ('ExcelLab.Native' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace ExcelLab { public static class Native {
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}}
'@
}

function RC($Object) {
    if ($null -ne $Object -and [Runtime.InteropServices.Marshal]::IsComObject($Object)) {
        [void]$script:ComObjects.Add($Object)
    }
    Write-Output -NoEnumerate $Object
}

function Write-Json($Path, $Value) {
    $text = ConvertTo-Json -InputObject $Value -Depth 80
    [IO.File]::WriteAllText($Path, $text + "`n", (New-Object Text.UTF8Encoding($false)))
}

function Shared-FileHash($Path) {
    $stream=$null;$sha=$null
    try {
        $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
        $sha=[Security.Cryptography.SHA256]::Create()
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
    } finally {if($stream){$stream.Dispose()};if($sha){$sha.Dispose()}}
}

function New-Sheet($Name) {
    $s = RC ($script:Book.Worksheets.Add())
    $s.Name = $Name
    $s.Cells.Font.Name = 'Hanjin Group Sans'
    $s.Cells.Font.Size = 11
    return ,$s
}

function Cell($Sheet, [int]$Row, [int]$Column) { RC ($Sheet.Cells.Item($Row, $Column)) }
function Range($Sheet, $Address) { RC ($Sheet.Range($Address)) }

function Write-Table($Sheet, $Columns, $Rows, $TableName, [bool]$AllText = $false) {
    for ($c=0; $c -lt $Columns.Count; $c++) { (Cell $Sheet 1 ($c+1)).Value2 = [string]$Columns[$c] }
    for ($r=0; $r -lt $Rows.Count; $r++) {
        for ($c=0; $c -lt $Columns.Count; $c++) {
            $v=$Rows[$r][$c]
            if ($null -eq $v) { continue }
            $ce=Cell $Sheet ($r+2) ($c+1)
            if ($AllText -or $v -is [string]) { $ce.NumberFormat='@'; $ce.Value2=[string]$v }
            else { $ce.Value2=[double]$v }
        }
    }
    $rng=RC ($Sheet.Range((Cell $Sheet 1 1),(Cell $Sheet ($Rows.Count+1) $Columns.Count)))
    if ($TableName) {
        $t=RC ($Sheet.ListObjects.Add(1,$rng,[Type]::Missing,1))
        $t.Name=$TableName
    }
    $rng.Columns.AutoFit() | Out-Null
    return ,$rng
}

function Read-Grid($Sheet, $Address) {
    if ($Address -is [string]) { $rng=Range $Sheet $Address }
    elseif ($null -ne $Address) { $rng=RC $Address }
    else { $rng=RC ($Sheet.UsedRange) }
    $nr=$rng.Rows.Count; $nc=$rng.Columns.Count
    $rng.Columns.AutoFit() | Out-Null
    $headers=@(); $rows=New-Object Collections.ArrayList; $display=New-Object Collections.ArrayList
    $errors=New-Object Collections.ArrayList
    for($c=1;$c -le $nc;$c++){ $headers += [string](RC ($rng.Cells.Item(1,$c))).Value2 }
    for($r=2;$r -le $nr;$r++) {
        $line=@();$shown=@()
        for($c=1;$c -le $nc;$c++) {
            $ce=RC ($rng.Cells.Item($r,$c)); $v=$ce.Value2; $txt=[string]$ce.Text
            $line+=,$v; $shown+=,$txt
            if($v -is [int] -and $v -lt -2000000000) {
                [void]$errors.Add([ordered]@{row=$r-1;column=$headers[$c-1];value=$v;text=$txt})
            }
        }
        [void]$rows.Add($line);[void]$display.Add($shown)
    }
    return [ordered]@{columns=$headers;rows=@($rows.ToArray());display=@($display.ToArray());row_count=$nr-1;excel_error_cells=@($errors.ToArray())}
}

function Col($Grid,$Name) {
    $idx=[array]::IndexOf([object[]]$Grid.columns,$Name)
    if($idx -lt 0){throw "Column $Name missing"}
    $values=@(); foreach($row in $Grid.rows){$values+=,$row[$idx]}; return ,$values
}
function Value-At($Grid,[int]$Row,$Name) { $i=[array]::IndexOf([object[]]$Grid.columns,$Name); if($i -lt 0){throw "Column $Name missing"}; return $Grid.rows[$Row][$i] }
function Total($Grid,$Name) { $sum=0.0; foreach($v in (Col $Grid $Name)){ if($null -ne $v -and $v -isnot [string] -and [double]$v -gt -2000000000){$sum += [double]$v} }; return $sum }
function Matches($Grid) { return @((Col $Grid 'Matched') | Where-Object {$_ -eq $true}).Count }
function Assert-Lab([bool]$Condition,[string]$Message) { [void]$script:Result.assertions.Add([ordered]@{name=$Message;passed=$Condition}); if(-not $Condition){throw "ASSERT: $Message"} }
function Expect-Lab([bool]$Condition,[string]$Message) { [void]$script:Result.expectations.Add([ordered]@{name=$Message;matched=$Condition}); if(-not $Condition){[void]$script:Result.differences_from_brief.Add($Message)} }
function Note($Text) { [void]$script:Result.observations_ko.Add([string]$Text) }

function Error-Info($Record) {
    $e=$Record.Exception
    $chain=@()
    while($null -ne $e) {
        $entry=[ordered]@{type=$e.GetType().FullName;message=$e.Message;hresult=$e.HResult}
        if($e -is [Runtime.InteropServices.COMException]) { $entry.error_code=$e.ErrorCode }
        $chain+=,$entry; $e=$e.InnerException
    }
    return [ordered]@{message=$Record.Exception.Message;fully_qualified_error_id=$Record.FullyQualifiedErrorId;exception_chain=$chain}
}

function Get-M($Key) {
    $m=[IO.File]::ReadAllText((Join-Path $script:CaseDir ($script:Spec.query_files.$Key)))
    $m=$m.Replace('{{INPUT_XLSX}}',(Join-Path $script:CaseDir 'input.xlsx'))
    $m=$m.Replace('{{SOURCE_CSV}}',(Join-Path $script:CaseDir 'source.csv'))
    return $m
}

function Load-Q($Key) {
    $m=Get-M $Key
    $q=RC ($script:Book.Queries.Add($Key,$m))
    $s=New-Sheet ('Q_'+$Key)
    $connection='OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location='+$Key+';Extended Properties=""'
    $lo=RC ($s.ListObjects.Add(0,$connection,[Type]::Missing,1,(Range $s 'A1')))
    $qt=RC ($lo.QueryTable)
    $qt.CommandType=2
    $qt.CommandText='SELECT * FROM ['+$Key+']'
    $qt.BackgroundQuery=$false
    $h=@{Key=$Key;M=$m;Sheet=$s;Table=$lo;QT=$qt}
    $script:Handles[$Key]=$h
    return (Refresh-Q $h ($Key+'_load'))
}

function Refresh-Q($Handle,$StepName) {
    $observed=[ordered]@{refresh_return=$null;refreshing=$null;load_error=$null;table=$null}
    try {
        $observed.refresh_return=$Handle.QT.Refresh($false)
        $observed.refreshing=$Handle.QT.Refreshing
        $observed.table=Read-Grid $Handle.Sheet $Handle.Table.Range
    } catch { $observed.load_error=Error-Info $_ }
    [void]$script:Result.steps.Add([ordered]@{name=$StepName;formula_or_m=$Handle.M;observed=$observed})
    $script:QueryCount++
    return $observed
}

function Q-Grid($Key) {
    $o=Load-Q $Key
    if($null -ne $o.load_error){throw "Query '$Key' failed: $($o.load_error.message)"}
    return $o.table
}

function Add-Step($Name,$Code,$Observed) {
    [void]$script:Result.steps.Add([ordered]@{name=$Name;formula_or_m=$Code;observed=$Observed})
}

function Read-Formulas($Sheet,$Address) {
    $rng=Range $Sheet $Address
    $items=@()
    for($r=1;$r -le $rng.Rows.Count;$r++){for($c=1;$c -le $rng.Columns.Count;$c++){
        $ce=RC ($rng.Cells.Item($r,$c))
        if($ce.HasFormula){$items+=,@{row=$ce.Row;column=$ce.Column;formula=$ce.Formula;value=$ce.Value2;text=$ce.Text}}
    }}
    return ,$items
}

function Excel-Formula($Sheet,$Address,$Formula) {
    $r=Range $Sheet $Address
    $r.NumberFormat='0.###############'
    $r.Formula=$Formula
    $script:Excel.Calculate()
    return $r.Value2
}

function Screenshot-Pdf($Pdf,$Name,$SheetName,$Address) {
    $path=Join-Path $script:CaseDir ($Name+'.png')
    $metaText=python (Join-Path $PSScriptRoot 'rasterize.py') $Pdf $path
    if($LASTEXITCODE -ne 0){throw "Native Excel PDF rasterization failed"}
    $meta=$metaText | ConvertFrom-Json
    [void]$script:Result.screenshots.Add([ordered]@{
        file=$Name+'.png';valid=$true;method='ExportAsFixedFormat + PyMuPDF';sheet=$SheetName;range=$Address
        width=$meta.width;height=$meta.height;distinct_colors=$meta.distinct_colors;pdf_text_checked=$meta.pdf_text_checked;pdf_pages=$meta.pdf_pages
        bytes=(Get-Item -LiteralPath $path).Length;sha256=(Shared-FileHash $path)
        clipboard='Untouched: GetDataObject failed in this session; both CopyPicture modes require clipboard access'
    })
}

function Screenshot($Sheet,$Address,$Name) {
    if($Address -is [string]){$rng=Range $Sheet $Address}else{$rng=RC $Address}
    $formats=@()
    if($script:Result.slug -in @('excel-duplicate-key-before-vlookup','excel-text-stored-numbers-convert')){foreach($cell in $rng.Cells){
        $cell=RC $cell
        if($cell.Value2 -is [double] -and $cell.NumberFormat -eq '0.###############'){
            $formats+=,@{cell=$cell;format=$cell.NumberFormat}
            $cell.NumberFormat='0'
        }
    }}
    $rng.Columns.AutoFit() | Out-Null
    $ps=RC ($Sheet.PageSetup)
    $properties=@('PrintArea','Zoom','FitToPagesWide','FitToPagesTall','Orientation','LeftMargin','RightMargin','TopMargin','BottomMargin','LeftHeader','CenterHeader','RightHeader','LeftFooter','CenterFooter','RightFooter','PrintTitleRows','PrintTitleColumns','PrintGridlines')
    $saved=@{};foreach($key in $properties){$saved[$key]=$ps.$key};$saved.Orientation=[int]$saved.Orientation
    $dir=Join-Path $PSScriptRoot ('runs/capture/'+$script:Result.slug)
    $null=New-Item -ItemType Directory -Force $dir
    $pdf=Join-Path $dir ($Name+'.pdf')
    try {
        $ps.PrintArea=$rng.Address();$ps.Zoom=$false;$ps.FitToPagesWide=1;$ps.FitToPagesTall=1
        $ps.Orientation=$(if($rng.Width -gt $rng.Height){2}else{1})
        $ps.LeftMargin=10;$ps.RightMargin=10;$ps.TopMargin=10;$ps.BottomMargin=10
        foreach($key in @('LeftHeader','CenterHeader','RightHeader','LeftFooter','CenterFooter','RightFooter','PrintTitleRows','PrintTitleColumns')){$ps.$key=''}
        $ps.PrintGridlines=$true
        $rng.ExportAsFixedFormat(0,$pdf,0,$false,$false) | Out-Null
        Screenshot-Pdf $pdf $Name $Sheet.Name $rng.Address()
    } finally {
        foreach($item in $formats){$item.cell.NumberFormat=$item.format}
        foreach($key in $properties){try{$ps.$key=$saved[$key]}catch{throw "Restore PageSetup $key ($($saved[$key].GetType().FullName)): $($_.Exception.Message)"}}
    }
}

function Direct-CSV($Path) {
    $books=RC ($script:Excel.Workbooks)
    $csvBook=$null
    try {
        # Workbooks.Open with Local=true is Excel's direct-open parser, not OpenText/PQ.
        $csvBook=RC ($books.Open($Path,0,$true,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,[Type]::Missing,$true))
        $ws=RC ($csvBook.Worksheets.Item(1))
        $g=Read-Grid $ws $null
        if($g.columns -contains 'Date'){
            (Cell $ws 1 3).Value2='IsNumber'
            (Cell $ws 1 4).Value2='DirectISO'
            for($i=2;$i -le $g.row_count+1;$i++){
                $null=Excel-Formula $ws ('C'+$i) ('=ISNUMBER(B'+$i+')')
                $null=Excel-Formula $ws ('D'+$i) ('=IF(ISNUMBER(B'+$i+'),TEXT(B'+$i+',"yyyy-mm-dd"),"TEXT:"&B'+$i+')')
            }
            $g.date_audit=Read-Grid $ws ('A1:D'+($g.row_count+1))
        }
        return $g
    } finally {if($csvBook){$csvBook.Close($false)}}
}

function Suspend-WorkbookForFileMove {
    $path=Join-Path $script:CaseDir 'before-file-move.xlsx'
    try{$script:Book.SaveAs($path,51)} finally {
        if($script:Book){try{$script:Book.Close($false)}catch{}}
        if($script:Excel -and $script:OwnsExcel){try{$script:Excel.Quit()}catch{}}
        for($i=$script:ComObjects.Count-1;$i -ge 0;$i--){try{if([Runtime.InteropServices.Marshal]::IsComObject($script:ComObjects[$i])){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($script:ComObjects[$i])}}catch{}}
        $script:ComObjects.Clear()
        $script:Handles.Clear();$script:Book=$null;$script:Excel=$null;$script:InputSheet=$null;$script:InputRange=$null
        $script:OwnsExcel=$false
        [GC]::Collect();[GC]::WaitForPendingFinalizers()
    }
    for($i=0;$i -lt 30;$i++){if(-not (Get-Process -Id $script:excelPid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 200}
    $p=Get-Process -Id $script:excelPid -ErrorAction SilentlyContinue
    $forced=$false
    if($p -and $p.StartTime.ToUniversalTime().ToString('o') -eq $script:excelStart){Stop-Process -Id $script:excelPid -Force;$forced=$true;Start-Sleep -Milliseconds 200}
    $script:Result.retired_instances=@(@{pid=$script:excelPid;start_time=$script:excelStart;forced_owned_pid_only=$forced;owned_process_remaining=[bool](Get-Process -Id $script:excelPid -ErrorAction SilentlyContinue)})
    if($script:Result.retired_instances[0].owned_process_remaining){throw 'Source Excel instance did not exit before file move'}
    return $path
}

function Resume-WorkbookAfterFileMove($Path) {
    $baseline=@(Get-Process EXCEL -ErrorAction SilentlyContinue|ForEach-Object{$_.Id})
    $script:OwnsExcel=$false
    $script:Excel=RC (New-Object -ComObject Excel.Application)
    [uint32]$nativePid=0
    [void][ExcelLab.Native]::GetWindowThreadProcessId([IntPtr]$script:Excel.Hwnd,[ref]$nativePid)
    $script:excelPid=[int]$nativePid
    if($baseline -contains $script:excelPid){throw 'Safety gate: restart returned a pre-existing Excel process'}
    $script:OwnsExcel=$true
    $script:Excel.Visible=$false;$script:Excel.DisplayAlerts=$false;$script:Excel.AskToUpdateLinks=$false;$script:Excel.AutomationSecurity=3
    $script:excelStart=(Get-Process -Id $script:excelPid).StartTime.ToUniversalTime().ToString('o')
    Write-Json (Join-Path $script:CaseDir 'owned-process.json') @{pid=$script:excelPid;start_time=$script:excelStart;runner_pid=$PID}
    $books=RC ($script:Excel.Workbooks)
    $script:Book=RC ($books.Open($Path,0,$false))
}
