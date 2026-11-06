$ErrorActionPreference='Stop'
. "$PSScriptRoot/common.ps1"
$owners=@{}
$files=@(Get-ChildItem -LiteralPath "$PSScriptRoot/runs" -Recurse -Filter *.json)
$files+=@(Get-ChildItem -LiteralPath "$PSScriptRoot/cases" -Recurse -Filter result.json)
$files+=@(Get-ChildItem -LiteralPath "$PSScriptRoot/cases" -Recurse -Filter owned-process.json)
foreach($f in $files){
    $r=Get-Content -Raw -Encoding UTF8 -LiteralPath $f.FullName|ConvertFrom-Json
    if($r.pid -and $r.start_time){$entries=@($r)}
    elseif($r.slug -and $r.cleanup){$entries=@(@{pid=$r.cleanup.owned_pid;start_time=$r.cleanup.owned_start_time})+@($r.retired_instances)}
    else{continue}
    foreach($o in $entries){if($o -and $o.pid -gt 0){$owners[([string]$o.pid+'|'+$o.start_time)]=$o}}
}
$checks=@()
foreach($key in @($owners.Keys|Sort-Object)){
    $o=$owners[$key];$p=Get-Process -Id $o.pid -ErrorAction SilentlyContinue
    $same=$false
    if($p){$same=$p.StartTime.ToUniversalTime().ToString('o') -eq $o.start_time}
    $checks+=,@{pid=$o.pid;recorded_start_time=$o.start_time;owned_process_still_running=$same}
}
$remaining=@($checks|Where-Object{$_.owned_process_still_running}).Count
Write-Json "$PSScriptRoot/process-verification.json" @{checked_at=[DateTime]::UtcNow.ToString('o');owned_instances_checked=$checks.Count;remaining_owned_count=$remaining;instances=$checks}
Write-Output "Owned Excel instances checked: $($checks.Count); still running: $remaining"
if($remaining -gt 0){exit 1}else{exit 0}
