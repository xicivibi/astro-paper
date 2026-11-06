param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "excel-text-stored-numbers-convert" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
