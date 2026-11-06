param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-fill-down-merged-cells" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
