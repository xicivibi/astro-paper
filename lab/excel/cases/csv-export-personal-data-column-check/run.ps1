param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "csv-export-personal-data-column-check" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
