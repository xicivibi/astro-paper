param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-merge-key-whitespace" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
