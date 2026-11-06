param([switch]$BuildOnly)
& "$PSScriptRoot/../../runner.ps1" -Slug "power-query-csv-date-using-locale" -BuildOnly:$BuildOnly
exit $LASTEXITCODE
