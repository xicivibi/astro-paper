param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-type-change-error-rows" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
