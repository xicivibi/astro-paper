param([string]$RunLabel='latest',[int]$CaseTimeoutSeconds=180)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/common.ps1"
if($RunLabel -notmatch '^[a-zA-Z0-9_-]+$'){throw 'RunLabel must be a simple directory name'}
$manifest=Get-Content -Raw -Encoding UTF8 "$PSScriptRoot/manifest.json" | ConvertFrom-Json
$archive=Join-Path $PSScriptRoot ('runs/'+$RunLabel)
$null=New-Item -ItemType Directory -Force -Path $archive
$entries=@()
foreach($slug in $manifest){
    $caseDir=Join-Path $PSScriptRoot ('cases/'+$slug)
    $log=Join-Path $archive ($slug+'.stdout.log');$err=Join-Path $archive ($slug+'.stderr.log')
    $args='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $caseDir 'run.ps1')+'"'
    $p=Start-Process -FilePath 'powershell.exe' -ArgumentList $args -WindowStyle Hidden -PassThru -RedirectStandardOutput $log -RedirectStandardError $err
    [void]$p.Handle
    $finished=$p.WaitForExit($CaseTimeoutSeconds*1000)
    if(-not $finished){
        # Read only the ownership record written by this child, verify both PIDs/start time.
        $ownership=Join-Path $caseDir 'owned-process.json'
        if(Test-Path -LiteralPath $ownership){
            $o=Get-Content -Raw -Encoding UTF8 $ownership|ConvertFrom-Json
            if($o.runner_pid -eq $p.Id){$ep=Get-Process -Id $o.pid -ErrorAction SilentlyContinue;if($ep -and $ep.StartTime.ToUniversalTime().ToString('o') -eq $o.start_time){Stop-Process -Id $o.pid -Force}}
        }
        if(-not $p.HasExited){Stop-Process -Id $p.Id -Force}
        $entry=@{slug=$slug;status='fail';reason='Per-case timeout; only the child runner and its recorded Excel PID were stopped';exit_code=$null}
    } else {
        $p.WaitForExit()
        $path=Join-Path $caseDir 'result.json'
        if(Test-Path -LiteralPath $path){
            $r=Get-Content -Raw -Encoding UTF8 $path|ConvertFrom-Json
            $entry=@{slug=$slug;status=$r.status;reason=$(if($r.failure){$r.failure.message}else{'All case assertions passed'});exit_code=$p.ExitCode;differences_from_brief=$r.differences_from_brief;not_verified=$r.not_verified;owned_process_remaining=$r.cleanup.owned_process_remaining}
            Copy-Item -LiteralPath $path -Destination (Join-Path $archive ($slug+'.json'))
        } else {$entry=@{slug=$slug;status='fail';reason=([IO.File]::ReadAllText($err));exit_code=$p.ExitCode}}
    }
    $entries+=,$entry
    Write-Output ($slug+': '+$entry.status+' - '+$entry.reason)
    Write-Json "$PSScriptRoot/summary.json" @{run_label=$RunLabel;run_at=[DateTime]::UtcNow.ToString('o');cases=$entries;complete=($entries.Count -eq $manifest.Count)}
}
$summary=@{run_label=$RunLabel;run_at=[DateTime]::UtcNow.ToString('o');cases=$entries;complete=$true;passed=@($entries|Where-Object{$_.status -eq 'pass'}).Count;failed=@($entries|Where-Object{$_.status -ne 'pass'}).Count}
Write-Json "$PSScriptRoot/summary.json" $summary
Write-Json (Join-Path $archive 'summary.json') $summary
python (Join-Path $PSScriptRoot 'sanitize_public.py')
if($LASTEXITCODE -ne 0){throw 'Public evidence sanitization failed'}
# Archive the finalized JSON so its workbook hash matches the sanitized workbook.
foreach($slug in $manifest){
    $path=Join-Path $PSScriptRoot ('cases/'+$slug+'/result.json')
    if(Test-Path -LiteralPath $path){Copy-Item -LiteralPath $path -Destination (Join-Path $archive ($slug+'.json'))}
}
if($summary.failed -gt 0){exit 1}else{exit 0}
