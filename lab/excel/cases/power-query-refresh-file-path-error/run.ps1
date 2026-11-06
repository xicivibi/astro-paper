param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-refresh-file-path-error" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
