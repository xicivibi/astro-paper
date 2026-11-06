param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "excel-duplicate-key-before-vlookup" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
