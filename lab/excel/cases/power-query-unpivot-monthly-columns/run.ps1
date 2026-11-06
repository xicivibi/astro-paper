param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-unpivot-monthly-columns" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
