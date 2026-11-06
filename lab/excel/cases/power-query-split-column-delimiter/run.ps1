param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-split-column-delimiter" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
