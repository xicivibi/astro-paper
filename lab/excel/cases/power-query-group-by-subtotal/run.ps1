param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-group-by-subtotal" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
